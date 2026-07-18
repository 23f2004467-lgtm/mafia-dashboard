import React, { useCallback, useEffect, useState } from "react";
import Toast from "./Toast";
import "./ToastHost.css";

/**
 * ToastHost — mounts once per portal and renders the toast queue (§8).
 *
 * Imperative API (no context): `toast(opts)` — module-level emitter; the
 * mounted host listens and renders. Max 2 toasts on screen; further toasts
 * queue FIFO and appear as slots free.
 *
 *   toast("Saved")                                  // info
 *   toast({ tone: "success", message: "Saved · Priya" })
 *   toast({ message: "Saved · Priya", undo: { label: "Undo", onUndo, ms: 10000 } })
 *
 * `position`: "bottom-center" (mobile, above the ActionBar) |
 *             "bottom-right" (admin). aria-live="polite".
 */

const listeners = new Set();
let seq = 0;

export function toast(opts) {
  const o = typeof opts === "string" ? { message: opts } : opts || {};
  const item = {
    tone: o.undo ? "undo" : o.tone || "info",
    ttl: 3500,
    ...o,
    id: `ui-toast-${++seq}`,
  };
  listeners.forEach((notify) => notify(item));
  return item.id;
}

const MAX_VISIBLE = 2;

export default function ToastHost({ position = "bottom-center" }) {
  const [state, setState] = useState({ visible: [], queued: [] });

  useEffect(() => {
    const notify = (item) => {
      setState((s) =>
        s.visible.length < MAX_VISIBLE
          ? { ...s, visible: [...s.visible, item] }
          : { ...s, queued: [...s.queued, item] }
      );
    };
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  const handleDone = useCallback((id) => {
    setState((s) => {
      const visible = s.visible.filter((t) => t.id !== id);
      const queued = [...s.queued];
      while (visible.length < MAX_VISIBLE && queued.length > 0) {
        visible.push(queued.shift());
      }
      return { visible, queued };
    });
  }, []);

  return (
    <div
      className={`ui-toast-host ui-toast-host--${position}`}
      aria-live="polite"
    >
      {state.visible.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          tone={t.tone}
          message={t.message}
          undo={t.undo}
          ttl={t.ttl}
          onDone={handleDone}
        />
      ))}
    </div>
  );
}
