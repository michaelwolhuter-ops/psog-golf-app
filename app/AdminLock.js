"use client";

import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { useAdmin } from "@/lib/AdminContext";

// Shared admin unlock control. Used in two places:
// - Sidebar.js footer: the escape hatch that stays reachable even when the
//   nav is locked mid-round (see ScorecardLockContext) — don't remove this
//   usage, it's load-bearing for that fix.
// - page.js (Home dashboard): a compact copy in the top-right corner for
//   quick access without opening the sidebar drawer on mobile.
// Both read/write the same AdminContext, so unlocking in either place
// unlocks the whole site.
export default function AdminLock({ onClose = () => {}, compact = false }) {
  const { isAdmin, login, logout } = useAdmin();
  const [entering, setEntering] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const wrapClass = compact ? "text-xs w-44" : "text-xs w-full";

  if (isAdmin) {
    return (
      <div className={`flex items-center justify-between gap-3 text-xs ${compact ? "" : ""}`}>
        <span className="inline-flex items-center gap-1.5 text-fairway font-semibold">
          <Unlock size={13} /> Admin
        </span>
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="text-posgmuted hover:text-red-400 transition"
        >
          Log out
        </button>
      </div>
    );
  }

  if (!entering) {
    return (
      <button
        onClick={() => setEntering(true)}
        className={
          (compact
            ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-posgborder bg-posgcard "
            : "w-full flex items-center justify-between ") +
          "text-xs text-posgmuted hover:text-posgtext transition"
        }
      >
        {compact ? (
          <>
            <Lock size={12} /> Admin
          </>
        ) : (
          <>
            Player Version
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Admin
            </span>
          </>
        )}
      </button>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setChecking(true);
    setError("");
    const ok = await login(password);
    setChecking(false);
    if (!ok) {
      setError("Wrong password");
      return;
    }
    setPassword("");
    setEntering(false);
    onClose();
  }

  return (
    <form onSubmit={submit} className={`space-y-1.5 ${wrapClass}`}>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin password"
        className="w-full bg-posgbg border border-posgborder rounded-md px-2.5 py-1.5 text-xs text-posgtext"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={checking || !password}
          className="text-xs bg-fairway text-black font-semibold px-2.5 py-1 rounded-md disabled:opacity-50"
        >
          {checking ? "…" : "Unlock"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEntering(false);
            setError("");
            setPassword("");
          }}
          className="text-xs text-posgmuted hover:text-posgtext transition"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
    </form>
  );
}
