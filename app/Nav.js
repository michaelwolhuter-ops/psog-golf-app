"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/order-of-merit", label: "Order of Merit" },
  { href: "/handicaps", label: "Handicaps" },
  { href: "/players", label: "Players" },
  { href: "/events", label: "Events" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="bg-fairwaydark text-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-bold tracking-wide">POSG TOUR</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? "font-semibold underline underline-offset-4"
                  : "text-white/80 hover:text-white"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
