"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Flag,
  Trophy,
  // Target, // only used by the hidden Handicaps link below — re-add if it comes back
  BarChart3,
  BookOpen,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useScorecardLock } from "@/lib/ScorecardLockContext";
import AdminLock from "@/app/AdminLock";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/events", label: "Events & Results", icon: Flag },
  { href: "/order-of-merit", label: "Order of Merit", icon: Trophy },
  // Hidden from nav 2026-07-22, per Mike — the handicap breakdown already
  // lives on each player's own profile (Handicap section), so this separate
  // page felt redundant for now. Nothing deleted: app/handicaps/page.js and
  // its API route still work fine if linked to directly. Un-comment this
  // line (and the Target import above) to bring it back to the sidebar.
  // { href: "/handicaps", label: "Handicaps", icon: Target },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/rules", label: "Rules & Information", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

// `open`/`onClose` only matter below the md breakpoint (mobile drawer).
// On desktop the sidebar is always shown via the md:translate-x-0 /
// md:static overrides below, exactly as it was before mobile support
// was added — nothing here changes desktop appearance or behaviour.
// The AdminLock control below (see app/AdminLock.js) is deliberately kept
// in the sidebar footer even though a compact copy now also lives on the
// Home dashboard (2026-07-29) — this one stays reachable even when the nav
// is locked mid-round (see ScorecardLockContext), which is the escape hatch
// for handing the phone to an admin. Don't remove this usage.
export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();
  const { lockedScorecardId } = useScorecardLock();
  const locked = !!lockedScorecardId;

  return (
    <aside
      className={
        // h-screen (100vh) is a fallback for old browsers. On mobile, 100vh
        // often measures taller than what's actually visible once the
        // browser's address bar is showing, which was pushing the Admin
        // unlock control (in the footer below) past the bottom of the real
        // screen — reachable in theory, invisible in practice. h-[100svh]
        // uses the "small viewport height" unit, which always matches the
        // guaranteed-visible area, so the footer never gets pushed off.
        "w-64 shrink-0 h-screen h-[100svh] bg-posgcard border-r border-posgborder flex flex-col " +
        "fixed top-0 left-0 z-50 transition-transform duration-200 ease-out " +
        (open ? "translate-x-0" : "-translate-x-full") +
        " md:translate-x-0 md:static md:sticky md:top-0"
      }
    >
      <div className="px-5 pt-6 pb-5 border-b border-posgborder relative">
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden absolute top-4 right-4 text-posgmuted hover:text-posgtext p-1"
        >
          <X size={20} />
        </button>
        {/* Plain (non-navigating) while locked — this used to stay an
            unconditional Link to "/", which was a real escape hatch: tapping
            it navigated away from an in-progress scorecard just like any
            other link, unmounting that page and (under the old
            unmount-clears-the-lock design) silently freeing the device to
            wander off. AppShell's redirect guard would now bounce a click
            here straight back anyway, but rendering it as inert instead
            avoids a jarring flash-navigate-then-snap-back. */}
        {locked ? (
          <div
            aria-disabled="true"
            title="Finish this round to navigate elsewhere"
            className="flex flex-col items-center text-center gap-2 cursor-not-allowed"
          >
            <img
              src="/logo.png"
              alt="POSG Tour"
              className="h-24 w-auto opacity-60"
            />
            <div className="text-base font-bold tracking-wide text-posgtext leading-tight">
              POSG <span className="text-gold">TOUR</span>
            </div>
          </div>
        ) : (
          <Link href="/" onClick={onClose} className="flex flex-col items-center text-center gap-2">
            <img
              src="/logo.png"
              alt="POSG Tour"
              className="h-24 w-auto drop-shadow-[0_0_16px_rgba(212,175,55,0.35)]"
            />
            <div className="text-base font-bold tracking-wide text-posgtext leading-tight">
              POSG <span className="text-gold">TOUR</span>
            </div>
          </Link>
        )}
      </div>

      {locked && (
        <p className="px-5 pt-3 text-[11px] text-posgmuted leading-snug">
          Finish this round to navigate elsewhere.
        </p>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          if (locked && !active) {
            return (
              <div
                key={l.href}
                aria-disabled="true"
                title="Finish this round to navigate elsewhere"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-posgmuted/40 cursor-not-allowed select-none"
              >
                <Icon size={18} strokeWidth={2} />
                {l.label}
              </div>
            );
          }
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition " +
                (active
                  ? "bg-fairway/15 text-fairway font-semibold border border-fairway/30"
                  : "text-posgmuted hover:text-posgtext hover:bg-posgcardhover")
              }
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-posgborder">
        <AdminLock onClose={onClose} />
      </div>
    </aside>
  );
}
