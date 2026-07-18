import React from "react";
import Chip from "./Chip";
import "./Ticket.css";

/**
 * Ticket — the candidate record drawn as a physical event ticket (§11.2).
 * 1.5 px ink border, asymmetric --radius-ticket, dashed vertical perforation
 * separating the identity block from the pill "stub".
 *
 * Variants: standard · walkin (amber stub + WALK-IN micro-label) ·
 * compact (admin drawer header layout). `condensed` renders the slim
 * sticky-bar layout (name 16/600 + mono regNo); the scroll-driven
 * crossfade between layouts is the caller's job.
 *
 * regNo renders grouped with a middle dot ("23BCE · 7431") — display only,
 * the stored value is untouched.
 */
export function formatRegNo(regNo) {
  if (regNo == null) return "";
  const s = String(regNo).trim();
  const m = s.match(/^(.*?[A-Za-z])(\d{2,})$/);
  return m ? `${m[1]} · ${m[2]}` : s;
}

export default function Ticket({
  name,
  regNo,
  yearChip,
  pills,
  variant = "standard",
  condensed = false,
}) {
  const yearNode =
    yearChip == null ? null : React.isValidElement(yearChip) ? (
      yearChip
    ) : (
      <Chip>{yearChip}</Chip>
    );

  if (condensed) {
    return (
      <div className={`ui-ticket ui-ticket--${variant} ui-ticket--condensed`}>
        <span className="ui-ticket__condensed-name">{name}</span>
        <span className="ui-ticket__condensed-regno">{formatRegNo(regNo)}</span>
      </div>
    );
  }

  return (
    <div className={`ui-ticket ui-ticket--${variant}`}>
      <div className="ui-ticket__identity">
        <div className="ui-ticket__name">{name}</div>
        <div className="ui-ticket__well">{formatRegNo(regNo)}</div>
        {yearNode ? <div className="ui-ticket__year">{yearNode}</div> : null}
      </div>
      <div className="ui-ticket__stub">
        {variant === "walkin" ? (
          <span className="ui-ticket__walkin-label">WALK-IN</span>
        ) : null}
        {pills ? <div className="ui-ticket__pills">{pills}</div> : null}
      </div>
    </div>
  );
}
