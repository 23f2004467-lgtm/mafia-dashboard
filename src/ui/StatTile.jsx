import React, { useEffect, useRef, useState } from "react";
import "./StatTile.css";

/**
 * StatTile — admin stat-strip tile (§7.3).
 * Label: uppercase micro. Value: 40 px display, tabular. Optional sub line.
 * tone: "plain" | "actionable" (amber, e.g. Awaiting verification).
 * `onClick` makes the tile a real <button>. `loading` shows a skeleton "—".
 *
 * §9 #6 count-up: when `value` is a NUMBER, the tile animates previous → new
 * over ≤ 600 ms with the --ease curve, ONCE per real change — a ref of the
 * last target guards against snapshot re-renders at the same value (which stay
 * static). Digits get the §4 per-digit width lock so Bakbak One's proportional
 * numerals never jitter. `format(n) => string` maps the animating number to its
 * display text (e.g. en-IN "₹" currency) and the animation lands EXACTLY on the
 * real value (Math.round — no float artifacts). Non-numeric values (strings,
 * nodes) render as-is, so the component API stays backward-compatible.
 * Reduced motion → instant final value (matchMedia check; no rAF).
 */

const COUNT_UP_MS = 600;

/** cubic-bezier(0.2, 0, 0, 1) — the --ease token solved in JS for the count-up
 *  (JS-driven content interpolation, not a CSS animation → no new @keyframes). */
function easeToken(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Solve the curve parameter u for horizontal position x (P1x=0.2, P2x=0).
  let lo = 0;
  let hi = 1;
  let u = x;
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2;
    const cx = 3 * (1 - u) * (1 - u) * u * 0.2 + u * u * u;
    if (cx < x) lo = u;
    else hi = u;
  }
  // Vertical position y for that u (P1y=0, P2y=1).
  return 3 * (1 - u) * u * u + u * u * u;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * CountUpValue — animates a numeric value previous → new over ≤ 600 ms --ease,
 * once per real change (mount and same-value snapshot ticks render statically).
 * Digits are wrapped in the §4 `.digit` width lock so tiles never jitter.
 */
function CountUpValue({ value, format }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const targetRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (targetRef.current === value) return undefined;
    targetRef.current = value;
    const from = displayRef.current;
    if (prefersReducedMotion()) {
      // RM: instant final value (§9 #6).
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / COUNT_UP_MS);
      const next =
        t >= 1 ? value : Math.round(from + (value - from) * easeToken(t));
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const text = format ? format(display) : String(display);
  return (
    <>
      {Array.from(text).map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <span key={i} className="digit">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </>
  );
}

export default function StatTile({
  label,
  value,
  sub,
  tone = "plain",
  onClick,
  loading = false,
  format,
}) {
  const className = `ui-stat-tile ui-stat-tile--${tone}${
    loading ? " is-loading" : ""
  }`;

  const valueNode = loading ? (
    "—"
  ) : typeof value === "number" ? (
    <CountUpValue value={value} format={format} />
  ) : (
    value
  );

  const content = (
    <>
      <span className="ui-stat-tile__label">{label}</span>
      <span className="ui-stat-tile__value tnum">{valueNode}</span>
      {!loading && sub != null ? (
        <span className="ui-stat-tile__sub">{sub}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
