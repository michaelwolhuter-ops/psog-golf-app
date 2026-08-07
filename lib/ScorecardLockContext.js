'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Site-wide "this device has an unfinished scorecard open" lock, keyed by
// the scorecard's id (not just a plain true/false) so AppShell knows exactly
// where to send a locked player back to.
//
// Persisted to localStorage — this used to be plain React state that was
// cleared the instant the scorecard page unmounted, which meant ANY way of
// leaving that page (the sidebar logo, a browser back-gesture, closing and
// reopening the tab) silently cleared the lock and let a "player" device
// wander off to Dashboard/Events and open a *different* group's scorecard
// while theirs was still sitting unfinished. Mike confirmed this was still
// happening 2026-07-3x. Now the lock only clears when the scorecard page
// itself decides the round is genuinely over (isAdmin, or status flips to
// completed) or the player finishes/abandons it — see app/scorecards/[id]/
// page.js — and AppShell enforces it on every route change via a redirect
// guard, not just by disabling sidebar links while the page happens to still
// be mounted.
const ScorecardLockContext = createContext({
  lockedScorecardId: null,
  myScorecardIds: [],
  ready: false,
  setLockedScorecardId: () => {},
});

const STORAGE_KEY = 'posg_locked_scorecard_id';

// Separate from STORAGE_KEY above on purpose: STORAGE_KEY only ever holds
// the CURRENT lock (or nothing), cleared the moment a round finishes or is
// abandoned. This one only ever grows — every scorecard id this device has
// ever been locked to, kept even after that lock clears. It's what lets a
// non-admin's "Resume Entry" button (see ScorecardsSection.js, fixed
// 2026-08-07) tell "a round I started, that I've since lost my lock on for
// some reason (admin rescued a stuck device, cleared storage, etc.)" apart
// from "a round I've never touched" — without any real login to tie a
// device to a player. Deliberately per-device, not per-player: a genuinely
// different phone still won't see Resume Entry for a round it never opened,
// even if it's the same person/group — that gap is accepted, same as the
// existing "no real login" caveat elsewhere in this app.
const HISTORY_KEY = 'posg_my_scorecard_ids';

export function ScorecardLockProvider({ children }) {
  const [lockedScorecardId, setLockedScorecardIdState] = useState(null);
  const [myScorecardIds, setMyScorecardIds] = useState([]);
  // Same "ready" pattern as AdminContext — SSR/first paint has no
  // localStorage, so avoid guarding (redirecting) on a false-negative
  // "not locked" before the real stored value has been read.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLockedScorecardIdState(localStorage.getItem(STORAGE_KEY) || null);
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      setMyScorecardIds(raw ? JSON.parse(raw) : []);
    } catch {
      setMyScorecardIds([]);
    }
    setReady(true);
  }, []);

  function setLockedScorecardId(id) {
    setLockedScorecardIdState(id || null);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      // Add to history too, once, the moment a device is actually locked
      // to this scorecard — never removed when the lock later clears.
      setMyScorecardIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <ScorecardLockContext.Provider
      value={{ lockedScorecardId, myScorecardIds, ready, setLockedScorecardId }}
    >
      {children}
    </ScorecardLockContext.Provider>
  );
}

export function useScorecardLock() {
  return useContext(ScorecardLockContext);
}
