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
export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();

  return (
    <aside
      className={
        "w-64 shrink-0 h-screen bg-posgcard border-r border-posgborder flex flex-col " +
        "fixed top-0 left-0 z-50 transition-transform duration-200 ease-out " +
        (open ? "translate-x-0" : "-translate-x-full") +
        " md:translate-x-0 md:static md:sticky md:top-0"
      }
    >
      <div className="px-5 py-6 border-b border-posgborder flex items-center justify-between">
        <div>
          <div className="text-lg font-bold tracking-wide text-posgtext">
            POSG <span className="text-gold">TOUR</span>
          </div>
          <div className="text-xs text-posgmuted mt-0.5">Tour Manager</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden text-posgmuted hover:text-posgtext p-1"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
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

      <div className="px-5 py-4 border-t border-posgborder text-xs text-posgmuted">
        Administrator Version
      </div>
    </aside>
  );
}
