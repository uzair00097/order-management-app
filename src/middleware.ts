import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { generateRequestId } from "@/lib/logger";

const BODY_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MB — upload route handles its own 5 MB limit

const PREVIEW_MODE = process.env.PREVIEW_MODE === "true";

// Hard block: PREVIEW_MODE must never run in production
if (PREVIEW_MODE && process.env.NODE_ENV === "production") {
  throw new Error(
    "[middleware] PREVIEW_MODE=true is not allowed in production. " +
    "This disables authentication for all routes. Remove this env var immediately."
  );
}

export default withAuth(
  function middleware(req) {
    // Reject oversized request bodies before they reach route handlers
    if (req.method !== "GET" && req.method !== "HEAD" && !req.nextUrl.pathname.startsWith("/api/upload")) {
      const contentLength = req.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > BODY_SIZE_LIMIT) {
        return new NextResponse(
          JSON.stringify({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 1 MB limit." } }),
          { status: 413, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Attach a request ID for log correlation — reuse client-supplied one if present
    const requestId = req.headers.get("x-request-id") ?? generateRequestId();

    // Allow all dashboard access in preview mode (no DB needed)
    if (PREVIEW_MODE) {
      const res = NextResponse.next();
      res.headers.set("x-request-id", requestId);
      return res;
    }

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

    const res = NextResponse.next({
      request: { headers: new Headers(req.headers) },
    });
    res.headers.set("x-request-id", requestId);
    return res;
  },
  {
    callbacks: {
      // In preview mode skip token check entirely
      authorized: ({ token }) => PREVIEW_MODE || !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/orders/:path*",
    "/api/products/:path*",
    "/api/customers/:path*",
    "/api/admin/:path*",
    "/api/dsr/:path*",
    "/api/upload",
    "/api/push/:path*",
  ],
};
