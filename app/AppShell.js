"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

// Wraps Sidebar + page content and owns the open/closed state for the
// mobile drawer. Desktop layout is untouched — the sidebar is always
// visible there (md:translate-x-0 in Sidebar.js), this component only
// adds the mobile top bar + overlay + slide-in behaviour below the md
// breakpoint.
export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile-only top bar with hamburger — hidden entirely on desktop */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-posgcard border-b border-posgborder flex items-center px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-posgtext p-2 -ml-2"
        >
          <Menu size={22} />
        </button>
        <div className="ml-2 text-sm font-bold tracking-wide">
          POSG <span className="text-gold">TOUR</span>
        </div>
      </div>

      {/* Dark overlay behind the drawer, mobile only, tap to close */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* pt-20 on mobile clears the fixed top bar; md:pt-8 restores the
          original desktop spacing exactly as it was before this change */}
      <main className="flex-1 min-w-0 px-4 py-6 pt-20 md:px-8 md:py-8 md:pt-8 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
