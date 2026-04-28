import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DistributorNav } from "@/components/dashboard/DistributorNav";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const session = PREVIEW_MODE ? null : await getSession();
  if (!PREVIEW_MODE && (!session || session.user.role !== "DISTRIBUTOR")) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-800 to-purple-950 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-black text-sm tracking-tight">HR</span>
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm text-gray-900 tracking-wide">HR ENTERPRICES</p>
              <p className="text-[10px] text-purple-400 font-medium">Distributor Portal</p>
            </div>
          </div>
          <span className="text-xs text-gray-500">{session?.user.name ?? "Preview"}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">{children}</main>

      <DistributorNav />
    </div>
  );
}
