"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";
import { AdminProvider } from "@/lib/AdminContext";
import { ScorecardLockProvider, useScorecardLock } from "@/lib/ScorecardLockContext";

// Wraps Sidebar + page content and owns the open/closed state for the
// mobile drawer. Desktop layout is untouched — the sidebar is always
// visible there (md:translate-x-0 in Sidebar.js), this component only
// adds the mobile top bar + overlay + slide-in behaviour below the md
// breakpoint.
//
// Split into an outer/inner pair so the inner half can call
// useScorecardLock() — that hook needs to run INSIDE ScorecardLockProvider,
// which this same component renders, so the provider has to wrap it rather
// than the other way round.
export default function AppShell({ children }) {
  return (
    <AdminProvider>
      <ScorecardLockProvider>
        <AppShellInner>{children}</AppShellInner>
      </ScorecardLockProvider>
    </AdminProvider>
  );
}

function AppShellInner({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const { lockedScorecardId, ready } = useScorecardLock();

  // The actual enforcement of the player lock: no matter HOW a locked
  // non-admin ends up somewhere else (sidebar logo, browser back-gesture,
  // a bookmarked link, closing and reopening the tab), this fires on every
  // route change and sends them straight back to their unfinished
  // scorecard. This is what the old "just disable the sidebar links"
  // approach was missing — those only stop clicks on links that are still
  // on screen, not every other way of navigating. Waits for `ready` so it
  // doesn't fire on the very first render before localStorage has been
  // read (which would otherwise look like "not locked" for a frame).
  useEffect(() => {
    if (!ready || !lockedScorecardId) return;
    const target = `/scorecards/${lockedScorecardId}`;
    if (pathname !== target) {
      router.replace(target);
    }
  }, [ready, lockedScorecardId, pathname, router]);

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile-only top bar with hamburger — hidden entirely on desktop.
          Bumped from h-14/h-9 logo to h-20/h-14 so the logo actually reads
          on a phone screen — see main's pt-28 below, kept in sync with this
          bar's height. Logo is hidden here on the home/dashboard page only,
          since that page already shows its own big hero logo — showing both
          was a double-logo on mobile, per Mike. */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-20 bg-posgcard border-b border-posgborder flex items-center px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-posgtext p-2 -ml-2"
        >
          <Menu size={22} />
        </button>
        {!isHome && (
          <img src="/logo.png" alt="POSG Tour" className="ml-2 h-14 w-auto" />
        )}
      </div>

      {/* Dark overlay behind the drawer, mobile only, tap to close */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* pt-28 on mobile clears the taller h-20 fixed top bar; md:pt-8
          restores the original desktop spacing exactly as before */}
      <main className="flex-1 min-w-0 px-4 py-6 pt-28 md:px-8 md:py-8 md:pt-8 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
