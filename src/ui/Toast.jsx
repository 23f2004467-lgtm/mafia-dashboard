import React, { useEffect, useRef, useState } from "react";
import "./Toast.css";

/**
 * Toast — one toast (§8, §9 #12). Rendered by ToastHost.
 *
 * Tones: success | error | info | undo.
 * `undo: { label, onUndo, ms }` renders a countdown ring (SVG
 * stroke-dashoffset over `ms`, default 10s — a §9 named exception to the
 * motion tokens) with tabular remaining seconds and an action button.
 * Enter/exit: translateY + fade, 240ms; spring in, --ease out.
 * `onDone(id)` fires after the exit transition completes.
 */
const EXIT_MS = 240;
const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;

const TONE_GLYPH = { success: "✓", error: "×", info: "i" };

export default function Toast({ id, tone = "info", message, undo, ttl = 3500, onDone }) {
  const isUndo = Boolean(undo);
  const duration = isUndo ? undo.ms ?? 10000 : ttl;

  const [phase, setPhase] = useState("enter"); // enter | open | exit
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(duration / 1000));
  const [ringStarted, setRingStarted] = useState(false);
  const doneRef = useRef(false);

  // Enter on mount.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase("open");
        setRingStarted(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Lifetime + countdown.
  useEffect(() => {
    const startedAt = Date.now();
    const expire = setTimeout(() => setPhase("exit"), duration);
    let tick;
    if (isUndo) {
      tick = setInterval(() => {
        const remaining = Math.max(0, duration - (Date.now() - startedAt));
        setSecondsLeft(Math.ceil(remaining / 1000));
      }, 250);
    }
    return () => {
      clearTimeout(expire);
      if (tick) clearInterval(tick);
    };
  }, [duration, isUndo]);

  // Unmount notification after the exit transition.
  useEffect(() => {
    if (phase !== "exit") return undefined;
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        if (onDone) onDone(id);
      }
    }, EXIT_MS + 60);
    return () => clearTimeout(t);
  }, [phase, id, onDone]);

  const handleUndo = () => {
    if (phase === "exit") return;
    if (undo && undo.onUndo) undo.onUndo();
    setPhase("exit");
  };

  const classes = [
    "ui-toast",
    `ui-toast--${isUndo ? "undo" : tone}`,
    phase === "open" ? "ui-toast--open" : null,
    phase === "exit" ? "ui-toast--exit" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {isUndo ? (
        <span className="ui-toast__ring-wrap" aria-hidden="true">
          <svg
            className="ui-toast__ring"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <circle className="ui-toast__ring-track" cx="12" cy="12" r={RING_R} />
            <circle
              className="ui-toast__ring-fill"
              cx="12"
              cy="12"
              r={RING_R}
              style={{
                strokeDasharray: RING_C,
                strokeDashoffset: ringStarted ? RING_C : 0,
                /* §9 named exception: the undo ring's countdown runs on its
                   own duration (default 10s), linear, via stroke-dashoffset. */
                transition: `stroke-dashoffset ${duration}ms linear`,
              }}
            />
          </svg>
        </span>
      ) : (
        <span className={`ui-toast__glyph ui-toast__glyph--${tone}`} aria-hidden="true">
          {TONE_GLYPH[tone] || TONE_GLYPH.info}
        </span>
      )}
      <span className="ui-toast__message">{message}</span>
      {isUndo ? (
        <>
          <span className="ui-toast__seconds tnum">{secondsLeft}s</span>
          <button type="button" className="ui-toast__action" onClick={handleUndo}>
            {undo.label || "Undo"}
          </button>
        </>
      ) : null}
    </div>
  );
}
