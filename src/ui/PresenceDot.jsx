import React from "react";
import "./PresenceDot.css";

/**
 * derivePresence — pure derivation from a lastActive timestamp (ms).
 *   < 5 min   → { status: "active" }  solid green
 *   5–30 min  → { status: "idle" }    hollow amber
 *   > 30 min  → { status: "away" }    gray outline
 * Also returns ageMs and the mono age label ("7m", "2h", "3d"; "—" when
 * lastActive is missing/unparseable, which renders as "away").
 * Exported for unit testing; pass `now` for determinism.
 */
export function derivePresence(lastActive, now = Date.now()) {
  let t = NaN;
  if (typeof lastActive === "number") {
    t = lastActive;
  } else if (lastActive != null) {
    t = new Date(lastActive).getTime();
  }
  const ageMs = Number.isFinite(t) ? Math.max(0, now - t) : Infinity;

  let status;
  if (ageMs < 5 * 60000) {
    status = "active";
  } else if (ageMs <= 30 * 60000) {
    status = "idle";
  } else {
    status = "away";
  }

  let ageLabel;
  if (!Number.isFinite(ageMs)) {
    ageLabel = "—";
  } else {
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 60) {
      ageLabel = `${minutes}m`;
    } else if (minutes < 24 * 60) {
      ageLabel = `${Math.floor(minutes / 60)}h`;
    } else {
      ageLabel = `${Math.floor(minutes / (24 * 60))}d`;
    }
  }

  return { status, ageMs, ageLabel };
}

export default function PresenceDot({ lastActive, now }) {
  const { status, ageLabel } = derivePresence(lastActive, now);
  return (
    <span className={`ui-presence ui-presence--${status}`}>
      <span className="ui-presence__dot" aria-hidden="true" />
      <span className="ui-presence__age">{ageLabel}</span>
    </span>
  );
}
