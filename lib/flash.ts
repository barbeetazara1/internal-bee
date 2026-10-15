import { cookies } from "next/headers";

export type RevealedKey = { product: string; environment: string; key: string };

/** Menyimpan plaintext key sementara (5 menit, httpOnly) agar bisa ditampilkan SATU kali setelah redirect. */
export async function setKeyFlash(keys: RevealedKey[]) {
  (await cookies()).set("ib_keys", JSON.stringify(keys), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", path: "/", maxAge: 300 });
}
