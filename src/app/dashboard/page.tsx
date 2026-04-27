import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default async function DashboardRootPage() {
  if (PREVIEW_MODE) redirect("/dashboard/salesman/new-order");

  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "SALESMAN") redirect("/dashboard/salesman/new-order");
  if (role === "DISTRIBUTOR") redirect("/dashboard/distributor/orders");
  if (role === "ADMIN") redirect("/dashboard/admin/users");

  redirect("/login");
}
