"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { ActionResult } from "@/lib/result";
import { toast } from "./toast";

type Ctx = { extrasRef: React.MutableRefObject<Record<string, () => string>>; discardCount: number; bumpDiscard: () => void; editing: boolean; setEditing: (v: boolean) => void; isNew: boolean; listHref: string; pending: boolean; setPending: (v: boolean) => void; formRef: React.RefObject<HTMLFormElement | null> };
const RecordCtx = createContext<Ctx | null>(null);
export const useRecord = () => {
  const c = useContext(RecordCtx);
  if (!c) throw new Error("Harus di dalam <RecordProvider>");
  return c;
};

/** Record baru langsung mode edit; record yang sudah ada default-nya mode baca (tombol Edit). */
export function RecordProvider({ children, isNew = false, listHref }: { children: React.ReactNode; isNew?: boolean; listHref: string }) {
  const [editing, setEditing] = useState(isNew);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const extrasRef = useRef<Record<string, () => string>>({});
  const [discardCount, setDiscardCount] = useState(0);
  return <RecordCtx.Provider value={{ extrasRef, discardCount, bumpDiscard: () => setDiscardCount((c) => c + 1), editing, setEditing, isNew, listHref, pending, setPending, formRef }}>{children}</RecordCtx.Provider>;
}

/** Edit → (Save + Discard). Diletakkan di bawah judul halaman. */
export function RecordBar({ createHref, extra, center, right }: { createHref?: string; /** Tombol aksi tambahan, tampil di samping Edit saat mode baca. */ extra?: React.ReactNode; /** Konten di tengah baris (mis. menu More actions), tampil saat mode baca. */ center?: React.ReactNode; /** Konten di ujung kanan baris yang sama (mis. status), tampil di semua mode. */ right?: React.ReactNode }) {
  const { editing, setEditing, isNew, listHref, pending, formRef, bumpDiscard } = useRecord();
  return (
    <div className="no-print relative -mt-3 mb-5 flex items-center gap-2">
      {editing ? (
        <>
          <button key="save" type="submit" form="record-form" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
          {isNew ? (
            <Link key="discard" href={listHref} className="btn">Discard</Link>
          ) : (
            <button
              key="discard"
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => {
                formRef.current?.reset();
                bumpDiscard();
                setEditing(false);
              }}
            >
              Discard
            </button>
          )}
        </>
      ) : (
        <>
          {createHref && (
            <Link key="create" href={createHref} className="btn">
              <Plus size={15} /> Create
            </Link>
          )}
          <button key="edit" type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
          {extra}
        </>
      )}
      {/* Pada layar lebar, menu tengah dipusatkan tepat di tengah baris (bukan sisa ruang di antara tombol). */}
      {!editing && center && <div className="mx-auto xl:absolute xl:left-1/2 xl:mx-0 xl:-translate-x-1/2">{center}</div>}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function RecordForm({ action, className, locked = false, children }: { action: (fd: FormData) => Promise<ActionResult>; className?: string; /** Selalu readonly (mis. lead yang statusnya sudah lewat tahap tertentu). */ locked?: boolean; children: React.ReactNode }) {
  const { editing, setEditing, setPending, formRef, extrasRef } = useRecord();
  const router = useRouter();
  const [, start] = useTransition();
  const editedAt = useRef(0);
  const [tried, setTried] = useState(false); // sudah pernah mencoba Save → tampilkan field wajib yang kosong dengan warna merah
  const invalidCount = useRef(0);
  const invalidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mode baca: semua field dinonaktifkan (hidden input tetap aktif).
  useEffect(() => {
    if (editing) editedAt.current = Date.now();
    formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>("input:not([type=hidden]), select, textarea, button[data-select]").forEach((el) => {
      if (el.dataset.locked || el.closest("[data-locked-field]")) return;
      el.disabled = locked || !editing;
    });
  }, [editing, locked, formRef]);

  return (
    <form
      id="record-form"
      ref={formRef}
      className={`${className ?? ""} ${editing && !locked ? "" : "record-view"} ${tried ? "show-invalid" : ""}`}
      onInvalidCapture={() => {
        // Browser memicu "invalid" per field; kumpulkan lalu tampilkan satu notifikasi.
        setTried(true);
        invalidCount.current++;
        if (!invalidTimer.current)
          invalidTimer.current = setTimeout(() => {
            toast(`Lengkapi ${invalidCount.current} field wajib yang masih kosong sebelum menyimpan`, "error");
            invalidCount.current = 0;
            invalidTimer.current = null;
          }, 0);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        // Abaikan submit di mode baca atau klik ganda tak sengaja tepat setelah menekan Edit.
        if (!editing || Date.now() - editedAt.current < 600) return;
        const fd = new FormData(e.currentTarget);
        // Data tambahan dari komponen di luar <form> (mis. baris produk) ikut disimpan bersama.
        for (const [k, get] of Object.entries(extrasRef.current)) fd.set(k, get());
        setPending(true);
        start(async () => {
          try {
            const r = await action(fd);
            toast(r.message, !r.ok ? "error" : r.changed === false ? "info" : "success");
            if (r.ok) {
              if (r.redirectTo) router.push(r.redirectTo);
              else {
                setEditing(false);
                router.refresh();
              }
            }
          } catch {
            toast("Something went wrong. Please try again.", "error");
          } finally {
            setPending(false);
          }
        });
      }}
    >
      {children}
    </form>
  );
}

/**
 * Mode baca = readonly: semua tombol/input di dalamnya dinonaktifkan, mode edit mengaktifkannya kembali.
 * Elemen yang memang sudah disabled dari awal (mis. lead Closed Won) tetap disabled.
 */
export function EditLock({ className, children }: { className?: string; children: React.ReactNode }) {
  const { editing } = useRecord();
  const ref = useRef<HTMLDivElement>(null);
  // Tanpa deps: dijalankan setiap render agar elemen baru hasil refresh server ikut terkunci.
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>("button, input:not([type=hidden]), textarea").forEach((el) => {
      // Elemen ber-data-managed: status disabled-nya sepenuhnya ditentukan server lewat data-force-disabled (selalu terbaru).
      if (el.hasAttribute("data-managed")) {
        el.disabled = !editing || el.hasAttribute("data-force-disabled");
        return;
      }
      if (el.dataset.wasDisabled === undefined) el.dataset.wasDisabled = el.disabled ? "1" : "0";
      el.disabled = !editing || el.dataset.wasDisabled === "1" || el.hasAttribute("data-force-disabled");
    });
  });
  return (
    <div ref={ref} className={`${className ?? ""} ${editing ? "" : "edit-lock"}`}>
      {children}
    </div>
  );
}
