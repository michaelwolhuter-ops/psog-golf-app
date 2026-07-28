'use client';

import { useCallback, useRef, useState } from 'react';

// Replaces native window.confirm() — which renders as a jarring, unstyled
// browser-chrome popup (literally shows the URL, looks like a security
// warning) — with an in-app dialog matching the rest of the dark/gold
// theme. Mike flagged the native version as looking like a broken
// "internet pop-up" on Reopen/Delete/Finish actions.
//
// Usage mirrors window.confirm's ergonomics on purpose, so call sites barely
// change: `if (!(await confirm('Delete this?'))) return;` inside an async
// function, plus rendering `{ConfirmDialog}` once somewhere in the page.
export function useConfirm() {
  const [state, setState] = useState(null); // { message, confirmLabel }
  const resolveRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, confirmLabel: options.confirmLabel || 'Confirm' });
    });
  }, []);

  function respond(result) {
    setState(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }

  const ConfirmDialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => respond(false)}
    >
      <div
        className="bg-posgcard border border-posgborder rounded-xl p-5 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-posgtext mb-5 whitespace-pre-line">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => respond(false)}
            className="text-sm px-3 py-1.5 rounded-md bg-posgborder text-posgtext hover:bg-posgcardhover transition"
          >
            Cancel
          </button>
          <button
            onClick={() => respond(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-fairway text-black font-semibold hover:bg-fairwaydark hover:text-white transition"
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
