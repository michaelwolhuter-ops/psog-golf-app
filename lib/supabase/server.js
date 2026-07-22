import { createClient } from "@supabase/supabase-js";

// Every query Supabase makes internally goes through fetch() — and Next.js
// patches fetch() to cache responses on disk (.next/cache), not just in the
// running process. A normal restart never clears that folder, so a route
// whose query never changes shape (like Order of Merit's `select("*")`) can
// keep serving one frozen response forever, no matter how many times the
// dev server is stopped and started or the code around it changes. Forcing
// cache: "no-store" on every request this client makes closes that off for
// every route in the app, not just the one that surfaced it.
function noStoreFetch(url, options = {}) {
  return fetch(url, { ...options, cache: "no-store" });
}

// Phase 1 has no auth and no RLS (open site, per Mike's choice) — this is a
// plain server-side client using the anon key. All reads/writes go through
// app/api/* routes, never directly from client components.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { fetch: noStoreFetch } }
  );
}
