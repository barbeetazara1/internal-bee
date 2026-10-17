export const idr = (n: number | string | { toString(): string }) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n));

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(d)) : "—";

export const fmtDateTime = (d: Date | string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(d))
    : "—";

export const toInputDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
export const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

/** Tanggal kalender (YYYY-MM-DD) di zona waktu Asia/Jakarta, konsisten dengan fmtDate. Dipakai untuk mengelompokkan "hari yang sama". */
export const jktDay = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
/** Awal hari (00:00 WIB) untuk tanggal YYYY-MM-DD. */
export const jktDayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
