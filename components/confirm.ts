export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tindakan berisiko (hapus, cabut): tombol konfirmasi merah dan fokus awal di Cancel. */
  danger?: boolean;
};

const resolvers = new Map<number, (v: boolean) => void>();
let seq = 0;

/** Pengganti window.confirm: menampilkan dialog kita sendiri dan mengembalikan true/false. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const id = ++seq;
    resolvers.set(id, resolve);
    window.dispatchEvent(new CustomEvent("app:confirm", { detail: { id, opts } }));
  });
}

export function settleConfirm(id: number, value: boolean) {
  resolvers.get(id)?.(value);
  resolvers.delete(id);
}
