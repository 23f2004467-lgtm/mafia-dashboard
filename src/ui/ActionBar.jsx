import React from "react";
import "./ActionBar.css";

/**
 * ActionBar — sticky bottom action bar (§6.3). Layout shell only.
 *
 * `children`: the ONE primary action slot (caller passes its own Button).
 * `onOverflow`: when provided, renders the "⋯" overflow button.
 * `busy`: busy state — sets aria-busy and disables the overflow button;
 * the primary slot manages its own loading visuals.
 * Safe-area padded via --safe-bottom.
 */
export default function ActionBar({
  children,
  onOverflow,
  overflowLabel = "More options",
  busy = false,
}) {
  return (
    <div
      className={"ui-action-bar" + (busy ? " ui-action-bar--busy" : "")}
      aria-busy={busy || undefined}
    >
      <div className="ui-action-bar__primary">{children}</div>
      {onOverflow ? (
        <button
          type="button"
          className="ui-action-bar__overflow"
          onClick={onOverflow}
          disabled={busy}
          aria-label={overflowLabel}
          aria-haspopup="menu"
        >
          ⋯
        </button>
      ) : null}
    </div>
  );
}
