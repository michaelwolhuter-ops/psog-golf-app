"use client";

import { useEffect } from "react";

// Registers the PWA service worker (public/sw.js). Required for iOS/Android
// to treat this as an installable app — see public/sw.js for what it
// actually does (static-shell-only caching, no data caching).
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app works fine without it, this just loses the
        // "add to home screen" install prompt / offline shell.
      });
    }
  }, []);

  return null;
}
