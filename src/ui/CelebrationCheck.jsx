import React, { useMemo } from "react";
import "./CelebrationCheck.css";

/**
 * CelebrationCheck — the drawn tick (CELEBRATION block, owner 2026-07-20).
 * An SVG circle + tick that draw in via stroke-dashoffset (pathLength="1",
 * the GPay language), then pop once with the spring overshoot. Decoration
 * only: always aria-hidden; the facts it frames live outside it.
 *
 * - `drawn` false renders the mark COMPLETE and static (the not-selected
 *   "recorded" mark; also the reduced-motion collapse — CSS kills the
 *   animations there even when `drawn`).
 * - `tempo` "full" (green room: 460/240ms draw, pop at 780ms) or "brisk"
 *   (Done echo: 320/200ms, pop at 560ms) — the ms constants are the §6
 *   celebration choreography, named exceptions to the duration tokens.
 * - `ring` adds the ONE radiating pulse (green room only; born at the pop).
 * - `tone` "success" | "neutral" sets the ink; omit to inherit currentColor.
 * - One-shot law: everything runs once on mount, fill-mode both.
 */
export default function CelebrationCheck({
  size = 96,
  tone = null,
  drawn = true,
  ring = false,
  tempo = "full",
}) {
  const cls =
    "celebrate-check celebrate-once" +
    (tone ? ` celebrate-check--${tone}` : "") +
    (drawn ? ` celebrate-check--drawn celebrate-check--${tempo}` : "");
  return (
    <span
      className={cls}
      style={{ width: size + "px", height: size + "px" }}
      aria-hidden="true"
    >
      {ring && drawn ? <span className="celebrate-check__ring" /> : null}
      <svg className="celebrate-check__svg" viewBox="0 0 72 72" fill="none">
        <circle
          className="celebrate-check__circle"
          cx="36"
          cy="36"
          r="32"
          pathLength="1"
        />
        <path
          className="celebrate-check__tick"
          d="M22 37.5 L31.5 47 L50.5 27.5"
          pathLength="1"
        />
      </svg>
    </span>
  );
}

/** True when the OS asks for reduced motion (jsdom-safe). The transient
 *  celebration bits (confetti, flecks) must never render there. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The six canonical spectrum names, red → violet (§2 #50). */
const SPECTRUM = ["red", "orange", "amber", "green", "blue", "violet"];

/**
 * CelebrationBurst — the one-shot confetti burst (green room only; the
 * outcome-intensity law keeps it off every other surface). 24–40 DOM bits
 * in the six canonical spectrum tokens, randomized inline transforms and
 * delays, transform + opacity only, each bit's life < 1.5s, all gone
 * < 2.3s — inside the 2.5s auto-advance. aria-hidden, pointer-events
 * none, no canvas, no libraries, no loops. Never renders under reduced
 * motion.
 */
export function CelebrationBurst({ count = 32, delay = 820 }) {
  const bits = useMemo(() => {
    if (prefersReducedMotion()) return null;
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (30 + Math.random() * 140);
      const rise = -(40 + Math.random() * 90);
      const fall = 150 + Math.random() * 150;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 480);
      const life = 850 + Math.random() * 500;
      const wait = delay + Math.random() * 120;
      const shape = i % 3; // 0 rect · 1 square · 2 round
      list.push({
        key: i,
        color: SPECTRUM[i % 6],
        style: {
          "--cf-x": x.toFixed(0) + "px",
          "--cf-rise": rise.toFixed(0) + "px",
          "--cf-fall": fall.toFixed(0) + "px",
          "--cf-spin": spin.toFixed(0) + "deg",
          width: (shape === 0 ? 5 : 6) + "px",
          height: (shape === 0 ? 9 : 6) + "px",
          borderRadius: shape === 2 ? "50%" : "1px",
          animationDuration: life.toFixed(0) + "ms",
          animationDelay: wait.toFixed(0) + "ms",
        },
      });
    }
    return list;
  }, [count, delay]);

  if (!bits) return null;
  return (
    <span className="celebrate-burst celebrate-once" aria-hidden="true">
      {bits.map((b) => (
        <i
          key={b.key}
          className={"celebrate-burst__bit celebrate-burst__bit--" + b.color}
          style={b.style}
        />
      ))}
    </span>
  );
}
