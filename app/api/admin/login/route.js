import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Checks the submitted password against ADMIN_PASSWORD — a server-only env
// var (no NEXT_PUBLIC_ prefix), so the real value is never shipped to the
// browser bundle the way a NEXT_PUBLIC_ var would be. This is still only a
// UI-level convenience lock, not real security: Phase 1 has no RLS and
// every API route in this app is unauthenticated regardless of what this
// check says (see the RLS advisory flagged 2026-07-25) — a technically
// determined person could call any /api/* route directly and skip this
// entirely. It stops casual players from finding admin buttons, nothing more.
export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin password isn't configured on the server yet." },
      { status: 500 }
    );
  }

  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
