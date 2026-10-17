import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("ib_session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
      valid = true;
    } catch {}
  }
  if (pathname === "/login") return valid ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  if (!valid) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api/v1|api/cron|_next/static|_next/image|.*\\.(?:png|ico|svg|jpg|webp)$).*)"] };
