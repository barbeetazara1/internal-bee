"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function loginAction(_: string | null, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return "Email atau password salah.";
  }
  await createSession(user);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
