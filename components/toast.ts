export type ToastTone = "success" | "info" | "error";

/** Menampilkan notifikasi singkat; <Toaster/> di root layout yang merendernya. */
export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, tone } }));
}
