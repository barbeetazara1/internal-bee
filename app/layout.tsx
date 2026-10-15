import "./globals.css";
import type { Metadata } from "next";
import ConfirmHost from "@/components/ConfirmHost";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "@/lib/lang";
import I18nProvider from "@/components/I18nProvider";
import type { Lang } from "@/lib/lang";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = { title: "Internal Bee", description: "Portal operasional internal & manajemen lisensi" };

// Menerapkan tema sebelum render pertama agar tidak berkedip.
const themeScript = `document.documentElement.setAttribute("data-i18n","pending");setTimeout(function(){document.documentElement.removeAttribute("data-i18n")},2500);try{if(localStorage.getItem("sidebar")==="collapsed")document.documentElement.setAttribute("data-sb","collapsed")}catch(e){}try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === "en" ? "en" : "id";
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider lang={lang}>
          {children}
          <Toaster />
          <ConfirmHost />
        </I18nProvider>
      </body>
    </html>
  );
}
