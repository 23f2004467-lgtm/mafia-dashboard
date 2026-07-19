import React from "react";
import "./StatTile.css";

/**
 * StatTile — admin stat-strip tile (§7.3).
 * Label: uppercase micro. Value: 40 px display, tabular. Optional sub line.
 * tone: "plain" | "actionable" (amber, e.g. Awaiting verification).
 * `onClick` makes the tile a real <button>. `loading` shows a skeleton "—".
 */
export default function StatTile({
  label,
  value,
  sub,
  tone = "plain",
  onClick,
  loading = false,
}) {
  const className = `ui-stat-tile ui-stat-tile--${tone}${
    loading ? " is-loading" : ""
  }`;

  const content = (
    <>
      <span className="ui-stat-tile__label">{label}</span>
      <span className="ui-stat-tile__value tnum">{loading ? "—" : value}</span>
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
