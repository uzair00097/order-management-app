import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

export default withAuth(
  function middleware(req) {
    // Allow all dashboard access in preview mode (no DB needed)
    if (PREVIEW_MODE) return NextResponse.next();

    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith("/dashboard/salesman") && token?.role !== "SALESMAN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/dashboard/distributor") && token?.role !== "DISTRIBUTOR") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/dashboard/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // In preview mode skip token check entirely
      authorized: ({ token }) => PREVIEW_MODE || !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/api/orders/:path*", "/api/products/:path*", "/api/customers/:path*"],
};
