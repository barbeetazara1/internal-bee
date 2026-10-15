export const LANG_COOKIE = "ib_lang";
export const LANGUAGES = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];
