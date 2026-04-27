"use client";
import { useLocale } from "@/contexts/locale";

export function LangToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "ur" : "en")}
      className="text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors font-medium"
      title="Switch language / زبان تبدیل کریں"
    >
      {locale === "en" ? "اردو" : "English"}
    </button>
  );
}
