import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SalesmanNav } from "@/components/dashboard/SalesmanNav";
import { LangToggle } from "@/components/dashboard/LangToggle";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default async function SalesmanLayout({ children }: { children: React.ReactNode }) {
  const session = PREVIEW_MODE ? null : await getSession();
  if (!PREVIEW_MODE && (!session || session.user.role !== "SALESMAN")) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pl-56">
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between md:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-800 to-purple-950 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-black text-sm tracking-tight">HR</span>
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm text-gray-900 tracking-wide">HR ENTERPRICES</p>
              <p className="text-[10px] text-purple-400 font-medium">Sales Portal</p>
            </div>
          </div>
          <p className="hidden md:block font-semibold text-sm text-gray-700">Sales Portal</p>
          <div className="flex items-center gap-2">
            <LangToggle />
            <span className="text-xs text-gray-500">{session?.user.name ?? "Preview"}</span>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 md:px-8 md:py-6">{children}</main>

      <SalesmanNav />
    </div>
  );
}
