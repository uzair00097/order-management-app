"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en from "../../messages/en.json";
import ur from "../../messages/ur.json";

type Locale = "en" | "ur";
type Messages = typeof en;

const LocaleContext = createContext<{
  locale: Locale;
  t: (key: keyof Messages) => string;
  setLocale: (l: Locale) => void;
}>({
  locale: "en",
  t: (k) => en[k],
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "en" || saved === "ur") setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  const messages: Messages = locale === "ur" ? (ur as Messages) : en;
  const t = (key: keyof Messages): string => messages[key] ?? en[key];

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
