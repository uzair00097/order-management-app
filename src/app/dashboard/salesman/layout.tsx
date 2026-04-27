import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SalesmanNav } from "@/components/dashboard/SalesmanNav";
import { LangToggle } from "@/components/dashboard/LangToggle";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default async function SalesmanLayout({ children }: { children: React.ReactNode }) {
  const session = PREVIEW_MODE ? null : await getSession();
  if (!PREVIEW_MODE && (!session || session.user.role !== "SALESMAN")) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-gray-900">Orders</span>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <span className="text-xs text-gray-500">{session?.user.name ?? "Preview"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>

      <SalesmanNav />
    </div>
  );
}
