import React from "react";
import "./Chip.css";

/**
 * Chip — filter (with live count), rank (①②③, static), year (static).
 *
 * Variant is derived from props: `rank` present → rank chip (always static);
 * otherwise `onToggle` or `count` present → filter chip; otherwise year chip.
 * Interactive only when `onToggle` is provided (renders a <button> with
 * aria-pressed); static chips render as <span>.
 */
const RANK_GLYPHS = { 1: "①", 2: "②", 3: "③" };

export default function Chip({
  children,
  selected = false,
  onToggle,
  count,
  rank,
  disabled = false,
}) {
  const isRank = rank != null;
  const variant = isRank ? "rank" : onToggle || count != null ? "filter" : "year";

  const className = [
    "ui-chip",
    `ui-chip--${variant}`,
    selected ? "ui-chip--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {isRank ? (
        <span className="ui-chip__rank" aria-hidden="true">
          {RANK_GLYPHS[rank] || String(rank)}
        </span>
      ) : null}
      <span className="ui-chip__label">{children}</span>
      {count != null ? <span className="ui-chip__count tnum">{count}</span> : null}
    </>
  );

  if (onToggle && !isRank) {
    return (
      <button
        type="button"
        className={className}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
