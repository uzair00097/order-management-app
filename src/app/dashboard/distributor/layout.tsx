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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-gray-900">Distributor</span>
          </div>
          <span className="text-xs text-gray-500">{session?.user.name ?? "Preview"}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">{children}</main>

      <DistributorNav />
    </div>
  );
}
