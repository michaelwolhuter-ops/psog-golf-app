import { NextResponse } from "next/server";

// Belt-and-suspenders fix for the "page doesn't update after I save/clear
// something" bug. `export const dynamic = "force-dynamic"` on each route
// handler stops Next's server-side fetch cache from serving stale data, but
// it doesn't stop the browser itself from caching the GET response. This
// forces every /api/* response to carry Cache-Control: no-store, so the
// browser can never reuse an old response for the same URL.
export function middleware() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
