'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Site-wide "is this an admin or a player" flag. Everyone gets the same
// Player Version by default — clicking the lock in the sidebar, entering
// the password, unlocks the admin controls everywhere in the app (not
// just the current page), and stays unlocked across navigation/reloads
// via localStorage. This is a UI convenience lock only — see
// app/api/admin/login/route.js for the honest caveat about what it
// doesn't protect against.
const AdminContext = createContext({
  isAdmin: false,
  ready: false,
  login: async () => false,
  logout: () => {},
});

const STORAGE_KEY = 'posg_admin_unlocked';

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  // Avoids a flash of admin-only UI on first paint before localStorage has
  // been read (SSR has no access to it, so the first render is always
  // "player" — `ready` lets callers wait for the real value if it matters).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem(STORAGE_KEY) === 'true');
    setReady(true);
  }, []);

  async function login(password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }

  return (
    <AdminContext.Provider value={{ isAdmin, ready, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
