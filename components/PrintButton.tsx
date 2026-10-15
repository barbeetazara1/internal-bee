"use client";

export default function PrintButton() {
  return (
    <button className="btn btn-primary no-print" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </button>
  );
}
