import React, { useEffect, useState } from "react";
import "./Stamp.css";

/**
 * Stamp — the verdict stamp (§11.5). Done screen only.
 * tone "selected" renders "SELECTED · DANCE + MUSIC" (every selected domain
 * joined with "+", wrapping to two lines); tone "not_selected" renders
 * "NOT SELECTED". 2 px border, −2° rotation.
 *
 * Entrances (outcome-mapped intensity, owner 2026-07-20):
 * - "spring" (default, the shipped behavior): scale 1.06 → 1.0 via
 *   --ease-spring on mount (transition-based).
 * - "slam" (Done, selected): the celebrate-stamp-slam keyframe — enters
 *   at −5°/1.14, rotation overshoots past the seat, settles hard at −2°.
 *   One-shot; delay set by the host via --celebrate-stamp-delay.
 * - "quiet" (Done, not selected): a 240ms opacity fade at its resting
 *   −2° — the calm dignified close; no scale, no overshoot.
 */
export default function Stamp({
  domains = [],
  tone = "selected",
  entrance = "spring",
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, []);

  const text =
    tone === "not_selected"
      ? "NOT SELECTED"
      : `SELECTED${domains.length ? ` · ${domains.join(" + ")}` : ""}`;

  const cls =
    `ui-stamp ui-stamp--${tone}` +
    (entrance === "slam"
      ? " ui-stamp--slam celebrate-once"
      : entrance === "quiet"
      ? " ui-stamp--quiet"
      : "") +
    (entered ? " is-entered" : "");

  return <span className={cls}>{text}</span>;
}
