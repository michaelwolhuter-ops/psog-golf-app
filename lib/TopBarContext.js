'use client';

import { createContext, useContext, useState } from 'react';

// Lets one page contribute a short label shown next to the logo in
// AppShell's mobile top bar. Built for the scorecard entry screen
// (2026-09-17 cleanup) — that page's own header was stripped down to
// nothing for non-admins, and this is where the "what round is this"
// context moved to instead of disappearing entirely. Deliberately plain
// React state, not persisted — it only ever describes whatever page is
// currently mounted, and each such page is responsible for clearing it
// (return a cleanup function from its effect) when it unmounts.
const TopBarContext = createContext({ label: null, setLabel: () => {} });

export function TopBarProvider({ children }) {
  const [label, setLabel] = useState(null);
  return <TopBarContext.Provider value={{ label, setLabel }}>{children}</TopBarContext.Provider>;
}

export function useTopBarLabel() {
  return useContext(TopBarContext);
}
