import React from "react";
import "./Pill.css";

/**
 * Pill — the candidate-state pill (§5), pixel-identical in both portals.
 *
 * Width-lock (§9 #8): every state of the track is rendered as a stacked
 * "face" in the same grid cell; the active face is visible, the others are
 * transparent. The container is therefore always as wide as the widest
 * label of the track, so state flips never shift layout, and state changes
 * crossfade via stacked opacity layers (120 ms), per the motion laws.
 */
const TRACKS = {
  journey: [
    { key: "registered", label: "Registered" },
    { key: "checked_in", label: "Checked in" },
    { key: "selected", label: "Selected ✓" },
    { key: "not_selected", label: "Not selected" },
  ],
  payment: [
    { key: "unpaid", label: "Unpaid" },
    { key: "paid_unverified", label: "Paid · unverified" },
    { key: "verified", label: "Verified ✓" },
  ],
  // Track 2, INTERVIEWER + desk portal (owner 2026-07-20): a two-state view
  // — Unpaid or Paid ONLY (from `paid` alone; deriveInterviewerPayment). The
  // board's verification is admin-only, so interviewers never see the
  // three-state. "unpaid" is amber here ("collect money"), NOT the admin
  // dormant-neutral — the face colors are track-scoped in Pill.css (§5).
  paymentIv: [
    { key: "unpaid", label: "Unpaid" },
    { key: "paid", label: "Paid" },
  ],
};

export default function Pill({ track = "journey", state, size = "md" }) {
  const faces = TRACKS[track] || TRACKS.journey;
  return (
    <span className={`ui-pill ui-pill--${size} ui-pill--track-${track}`}>
      {faces.map((face) => (
        <span
          key={face.key}
          className={`ui-pill__face ui-pill__face--${face.key}${
            face.key === state ? " is-active" : ""
          }`}
          aria-hidden={face.key === state ? undefined : true}
        >
          {face.label}
        </span>
      ))}
    </span>
  );
}
