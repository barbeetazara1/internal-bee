"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { addComment } from "@/app/actions/comments";
import type { Change, RecordType } from "@/lib/activity";
import { toast } from "./toast";
import Section from "./Section";

export type ActivityDTO = {
  id: string;
  kind: "CREATED" | "UPDATED" | "EVENT" | "COMMENT" | "ALERT";
  body: string | null;
  changes: Change[];
  mentions: { id: string; name: string }[];
  author: { id: string; name: string };
  created_at: string;
};
type U = { id: string; name: string };

const COLORS = ["bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-rose-500", "bg-teal-500"];
const color = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const when = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function Avatar({ user, size = 8 }: { user: U; size?: number }) {
  return (
    <span className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color(user.id)}`} style={{ height: size * 4, width: size * 4 }} title={user.name}>
      {initials(user.name)}
    </span>
  );
}

/** Menyorot @Nama yang di-mention pada isi komentar. */
function Body({ text, mentions }: { text: string; mentions: U[] }) {
  if (!mentions.length) return <>{text}</>;
  const re = new RegExp(`(${mentions.map((m) => esc("@" + m.name)).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((part, i) =>
        mentions.some((m) => "@" + m.name === part) ? (
          <span key={i} className="rounded bg-sky-100 px-1 font-medium text-sky-700">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function Chatter({ recordType, recordId, recordLabel, items, users, meId }: { recordType: RecordType; recordId: string; recordLabel: string; items: ActivityDTO[]; users: U[]; meId: string }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<U[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Selalu gulir ke pesan terbaru (gaya chat).
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items.length]);

  const options = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.id !== meId && (u.name.toLowerCase().includes(q) || u.name.toLowerCase().split(" ").some((w) => w.startsWith(q)))).slice(0, 5);
  }, [query, users, meId]);

  function onChange(v: string, caret: number) {
    setText(v);
    const m = /(^|\s)@([^\s@]*)$/.exec(v.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  }

  function choose(u: U) {
    const ta = taRef.current!;
    const caret = ta.selectionStart;
    const before = text.slice(0, caret).replace(/@([^\s@]*)$/, `@${u.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setPicked((p) => (p.some((x) => x.id === u.id) ? p : [...p, u]));
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(before.length, before.length);
    });
  }

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    const mentionIds = picked.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id);
    start(async () => {
      const r = await addComment(recordType, recordId, body, mentionIds);
      toast(r.message, r.ok ? "success" : "error");
      if (r.ok) {
        setText("");
        setPicked([]);
      }
    });
  }

  return (
    <div className="mt-6" aria-label="History and comments" role="region">
    <Section title="History & Comments" subtitle={`${items.length} ${items.length === 1 ? "entry" : "entries"} · ${recordLabel}`} flush className="overflow-hidden">
      <div ref={listRef} className="max-h-[460px] space-y-4 overflow-y-auto bg-slate-50 p-5">
        {items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No history yet.</p>}
        {items.map((a) => {
          const mine = a.author.id === meId;
          const comment = a.kind === "COMMENT";
          return (
            <div key={a.id} className="flex items-end gap-2.5">
              <Avatar user={a.author} />
              <div className="max-w-[75%]">
                <div className="mb-1 flex items-baseline gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{mine ? "You" : a.author.name}</span>
                  <span>{when(a.created_at)}</span>
                </div>
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    comment ? (mine ? "bg-amber-400 text-slate-900" : "border border-slate-200 bg-surface") : "border border-dashed border-slate-300 bg-surface text-slate-600"
                  } rounded-bl-sm`}
                >
                  {a.kind === "CREATED" && <div className="font-medium">✨ Created this record</div>}
                  {a.kind === "UPDATED" && <div className="font-medium">✏️ Edited this record</div>}
                  {a.kind === "EVENT" && <div>{a.body}</div>}
                  {a.kind === "ALERT" && <div className="rounded-md border border-red-300 bg-red-500/10 px-2 py-1.5 font-medium text-red-700">{a.body}</div>}
                  {a.kind === "CREATED" && a.body && <div className="mt-1 text-xs">{a.body}</div>}
                  {a.kind === "UPDATED" && a.changes.length > 0 && (
                    <ul className="mt-1.5 space-y-1 text-xs">
                      {a.changes.map((c, i) => (
                        <li key={i}>
                          <span className="font-semibold">{c.field}:</span> <span className="text-slate-400 line-through">{c.from}</span> → <span className="font-medium text-slate-800">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {comment && <Body text={a.body ?? ""} mentions={a.mentions} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative border-t border-slate-100 p-4">
        {options.length > 0 && (
          <ul role="listbox" className="absolute bottom-full left-4 z-10 mb-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lg">
            {options.map((u, i) => (
              <li key={u.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(u);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-slate-100" : ""}`}
                >
                  <Avatar user={u} size={6} /> {u.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            value={text}
            rows={2}
            maxLength={4000}
            placeholder="Write a comment… use @ to mention a user"
            className="input resize-none"
            onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (options.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); return; }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(options[active]); return; }
                if (e.key === "Escape") { setQuery(null); return; }
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            }}
          />
          <button type="button" onClick={send} disabled={pending || !text.trim()} className="btn btn-primary h-[54px]">
            <Send size={15} /> {pending ? "Sending…" : "Send"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">Ctrl/⌘ + Enter to send. Mentioned users get a notification.</p>
      </div>
    </Section>
    </div>
  );
}
