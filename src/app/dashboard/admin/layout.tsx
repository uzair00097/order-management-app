import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminNav } from "@/components/dashboard/AdminNav";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = PREVIEW_MODE ? null : await getSession();
  if (!PREVIEW_MODE && (!session || session.user.role !== "ADMIN")) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pl-56">
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-gray-900">Admin</span>
          </div>
          <p className="hidden md:block font-semibold text-sm text-gray-700">Admin Portal</p>
          <span className="text-xs text-gray-500">{session?.user.name ?? "Preview"}</span>
        </div>
      </header>
      <main className="px-4 py-4 md:px-8 md:py-6">{children}</main>
      <AdminNav />
    </div>
  );
}
