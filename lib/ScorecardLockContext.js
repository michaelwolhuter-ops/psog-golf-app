'use client';

import { createContext, useContext, useState } from 'react';

// Site-wide "is a non-admin currently inside an in-progress scorecard"
// flag. When true, Sidebar disables its nav links so a player can't wander
// off to Dashboard/Events and open a *different* group's scorecard while
// theirs is still open — which is exactly what was happening before this
// existed. Set/cleared by the scorecard page itself (app/scorecards/[id]/
// page.js) based on isAdmin + the scorecard's status. The Admin unlock
// control in the sidebar footer is deliberately NOT gated by this, so an
// admin can always unlock and override from inside a locked scorecard.
const ScorecardLockContext = createContext({
  locked: false,
  setLocked: () => {},
});

export function ScorecardLockProvider({ children }) {
  const [locked, setLocked] = useState(false);
  return (
    <ScorecardLockContext.Provider value={{ locked, setLocked }}>
      {children}
    </ScorecardLockContext.Provider>
  );
}

export function useScorecardLock() {
  return useContext(ScorecardLockContext);
}
