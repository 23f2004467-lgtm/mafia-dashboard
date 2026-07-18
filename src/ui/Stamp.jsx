import React, { useEffect, useState } from "react";
import "./Stamp.css";

/**
 * Stamp — the verdict stamp (§11.5). Done screen only.
 * tone "selected" renders "SELECTED · DANCE + MUSIC" (every selected domain
 * joined with "+", wrapping to two lines); tone "not_selected" renders
 * "NOT SELECTED". 2 px border, −2° rotation, entering at scale 1.06 → 1.0
 * via --ease-spring on mount (transition-based — no new keyframes).
 */
export default function Stamp({ domains = [], tone = "selected" }) {
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

  return (
    <span
      className={`ui-stamp ui-stamp--${tone}${entered ? " is-entered" : ""}`}
    >
      {text}
    </span>
  );
}
