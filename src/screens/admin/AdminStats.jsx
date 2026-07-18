import React, { useEffect, useRef, useState } from "react";
import { StatTile } from "../../ui";
import "./AdminStats.css";

/**
 * AdminStats (§7.3) — the 4-tile stat strip. Presentational: every number
 * is computed in AdminPortal.jsx and passed down.
 *
 * 1. Candidates {total} — honest label pre-Phase-7 (§2 #36).
 * 2. Paid {x}/{y} + "% of candidates".
 * 3. Awaiting verification {n} — amber, ACTIONABLE: click applies the
 *    Paid·unverified filter and scrolls to the table.
 * 4. Revenue — full en-IN rupees (§2 #37) + "of which ₹X verified".
 *
 * Loading renders skeleton tiles with "—", never 0. Numerals count up
 * ≤ 600 ms on real data changes (§9 #6) with the §4 per-digit width lock
 * (the Phase 1 digit-uniformity check found Bakbak One digits non-uniform,
 * so the lock is REQUIRED for animated display numerals).
 */

/** cubic-bezier(0.2, 0, 0, 1) — the --ease token evaluated in JS for the
 *  §9 #6 count-up (JS-driven content interpolation, not a CSS animation). */
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

const COUNT_UP_MS = 600;

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * CountUp — animates previous → new over ≤ 600 ms --ease, once per real
 * data change (mount and same-value snapshot ticks render statically).
 * Digits are wrapped in the §4 `.digit` width lock so tiles never jitter.
 */
function CountUp({ value, format = String }) {
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

  const text = format(display);
  return (
    <span className="admin-stats__countup">
      {Array.from(text).map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <span key={i} className="digit">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  );
}

const inr = (n) => n.toLocaleString("en-IN");

export default function AdminStats({
  loading = false,
  total = 0,
  paid = 0,
  percentPaid = 0,
  awaiting = 0,
  revenue = 0,
  verifiedRevenue = 0,
  onAwaitingClick,
}) {
  return (
    <div className="admin-stats">
      <StatTile
        label="Candidates"
        loading={loading}
        value={<CountUp value={total} />}
      />
      <StatTile
        label="Paid"
        loading={loading}
        value={
          <span className="admin-stats__fraction">
            <CountUp value={paid} />
            <span className="admin-stats__slash" aria-hidden="true">
              /
            </span>
            <CountUp value={total} />
          </span>
        }
        sub={`${percentPaid}% of candidates`}
      />
      <StatTile
        label="Awaiting verification"
        tone="actionable"
        loading={loading}
        value={<CountUp value={awaiting} />}
        onClick={onAwaitingClick}
      />
      <StatTile
        label="Revenue"
        loading={loading}
        value={<CountUp value={revenue} format={(n) => `₹${inr(n)}`} />}
        sub={`of which ₹${inr(verifiedRevenue)} verified`}
      />
    </div>
  );
}
