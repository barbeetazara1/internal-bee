"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";

/** PDF yang ditanam di halaman (tanpa membuka tab baru), dengan tombol cetak untuk isinya. */
export default function PdfFrame({ src, withPrint = true, className = "h-[75vh]" }: { src: string; withPrint?: boolean; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const print = () => {
    try {
      ref.current?.contentWindow?.focus();
      ref.current?.contentWindow?.print();
    } catch {
      window.open(src, "_blank"); // cadangan bila browser menolak mencetak dari frame
    }
  };
  return (
    <div>
      {withPrint && <div className="no-print mb-3"><button type="button" className="btn btn-primary" onClick={print}><Printer size={15} /> Cetak / Simpan PDF</button></div>}
      <iframe ref={ref} src={src} title="PDF proposal" className={`w-full rounded-xl border border-slate-200 bg-white ${className}`} />
    </div>
  );
}
