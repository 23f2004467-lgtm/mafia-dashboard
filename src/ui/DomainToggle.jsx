import React from "react";
import "./DomainToggle.css";

/**
 * DomainToggle — full-width 56 px verdict row (§6.3 Zone D).
 *
 * off = surface + border; on = good tint + good ink + ✓ + weight 600.
 * `negative` variant ("Not selected — no committees") uses the ink OUTLINE
 * treatment when on (a decision, not an alarm — never red).
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
      <span className="ui-domain-toggle__check" aria-hidden="true">
        ✓
      </span>
    </button>
  );
}
