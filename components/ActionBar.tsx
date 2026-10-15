/** Baris tombol aksi di bawah judul untuk halaman tanpa mode Edit: aksi di kiri, kontrol status di ujung kanan. */
export default function ActionBar({ right, children }: { right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="no-print -mt-3 mb-5 flex flex-wrap items-center gap-2">
      {children}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
