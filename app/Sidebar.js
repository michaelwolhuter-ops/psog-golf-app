"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Flag,
  Trophy,
  Target,
  BarChart3,
  BookOpen,
  Settings as SettingsIcon,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/events", label: "Events & Results", icon: Flag },
  { href: "/order-of-merit", label: "Order of Merit", icon: Trophy },
  { href: "/handicaps", label: "Handicaps", icon: Target },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/rules", label: "Rules & Information", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-posgcard border-r border-posgborder flex flex-col">
      <div className="px-5 py-6 border-b border-posgborder">
        <div className="text-lg font-bold tracking-wide text-posgtext">
          POSG <span className="text-gold">TOUR</span>
        </div>
        <div className="text-xs text-posgmuted mt-0.5">Tour Manager</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
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
