import React from "react";
import "./DomainToggle.css";

/**
 * DomainToggle — full-width 56 px verdict row (§6.3 Zone D).
 *
 * The row's right edge carries a 24 px CHECKWELL — a ring that fills with
 * the state ink and pops a ✓ (scale 0.6 → 1, --ease-spring entrance) when
 * on. off = surface + border; on = good tint + good ink + weight 600.
 * `negative` variant ("Not selected — no committees") is the ink OUTLINE
 * treatment (a decision, not an alarm — never red): transparent row,
 * --text-1 outline and ring; on fills the well with --text-1.
 *
 * The confirm-on-clear interaction (§2 #10) is the CALLER's job: this
 * component only reports taps via onToggle.
 */
export default function DomainToggle({
  label,
  on = false,
  onToggle,
  negative = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`ui-domain-toggle${negative ? " ui-domain-toggle--negative" : ""}${
        on ? " is-on" : ""
      }`}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="ui-domain-toggle__label">{label}</span>
      <span className="ui-domain-toggle__well" aria-hidden="true">
        <svg
          viewBox="0 0 12 12"
          width="12"
          height="12"
          focusable="false"
          aria-hidden="true"
        >
          <path
            d="M2.4 6.4 5 9l4.6-5.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
