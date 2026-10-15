import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { Role } from "./constants";

export const SESSION_COOKIE = "ib_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function createSession(user: { id: string; role: string }) {
  const token = await new SignJWT({ uid: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({ where: { id: String(payload.uid) } });
    return user && user.is_active ? user : null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) redirect("/dashboard?denied=1");
  return user;
}

export const can = {
  manageProducts: (r: string) => r === "SUPER_ADMIN",
  manageLeads: (r: string) => r === "SUPER_ADMIN" || r === "SALES",
  manageLicense: (r: string) => r === "SUPER_ADMIN" || r === "PROJECT",
  revokeKey: (r: string) => r === "SUPER_ADMIN",
  manageProjects: (r: string) => r === "SUPER_ADMIN" || r === "PROJECT",
  manageBills: (r: string) => r === "SUPER_ADMIN" || r === "SALES",
  admin: (r: string) => r === "SUPER_ADMIN",
};
