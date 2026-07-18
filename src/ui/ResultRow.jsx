import React from "react";
import "./ResultRow.css";

/**
 * ResultRow — candidate search result (§6.2, §8).
 * Full-row button semantics: 72px min, name 18/600, mono regNo (grouped
 * display-only per §4: "23BCE · 7431"), year chip slot, payment pill slot,
 * chevron. `flash` drives the flash-success overlay (120ms in / 800ms out).
 */

function formatRegNo(regNo) {
  const raw = String(regNo == null ? "" : regNo).trim();
  const m = raw.match(/^(.+?)(\d{4})$/);
  return m ? m[1] + " · " + m[2] : raw;
}

export default function ResultRow({
  name,
  regNo,
  yearChip,
  paymentPill,
  onClick,
  flash = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={"ui-result-row" + (flash ? " ui-result-row--flash" : "")}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="ui-result-row__main">
        <span className="ui-result-row__name">{name}</span>
        <span className="ui-result-row__regno">{formatRegNo(regNo)}</span>
      </span>
      {yearChip ? (
        <span className="ui-result-row__chip">{yearChip}</span>
      ) : null}
      {paymentPill ? (
        <span className="ui-result-row__pill">{paymentPill}</span>
      ) : null}
      <svg
        className="ui-result-row__chevron"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 3.5 11 8l-5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
