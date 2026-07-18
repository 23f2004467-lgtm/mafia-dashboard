import React from "react";
import { Button, Pill, Stamp } from "../../ui";
import "./Done.css";

/**
 * Done — the §6.5 recap screen. Presentational: App.js latches the recap
 * ({name, verdict, paid, manuallyVerified}) BEFORE the routed reset wipes
 * the form, then routes here.
 *
 * - Big ✓ (success ink) · "{name} — recorded".
 * - The verdict Stamp (§11.5, this screen ONLY — §2 #47): EVERY selected
 *   domain across both committees joined with "+", wrapping when long;
 *   or "NOT SELECTED" (empty arrays — the §2 #30 display-local state).
 * - Payment pill (§5 track 2, from the latched paid/manuallyVerified).
 * - One 56px primary "Next candidate" → Search, cleared, autofocused
 *   (§2 #45: the ONLY route that autofocuses Search).
 * - Beneath the primary: the static light-theme lockup wordmark-black.png
 *   (~140px, decorative alt="") — a constant brand mark, NEVER a tick row
 *   or counter of any kind (§2 #33/#34: no interviewer-visible counts).
 */

/** Stamp copy uses the Zone-D short labels for WorkComm domains; the
 *  VALUES in the verdict arrays are the exact existing DB strings. */
const WORK_DOMAIN_LABELS = {
  "Human Resources": "HR",
  "Public Relations": "PR",
  "Social Media and Graphic Design": "SM&GD",
  "Photography and Videography": "P&V",
};

/** §5 Track 2 — payment pill state from existing paid/manuallyVerified. */
const derivePaymentState = (recap) =>
  recap && recap.paid
    ? recap.manuallyVerified
      ? "verified"
      : "paid_unverified"
    : "unpaid";

export default function Done({ recap, onNext }) {
  const talent = Array.isArray(recap?.verdict?.talentComm)
    ? recap.verdict.talentComm
    : [];
  const work = Array.isArray(recap?.verdict?.workComm)
    ? recap.verdict.workComm
    : [];
  const domains = [
    ...talent,
    ...work.map((d) => WORK_DOMAIN_LABELS[d] || d),
  ];
  const selected = domains.length > 0;

  return (
    <div className="iv-done">
      <div className="iv-done__check" aria-hidden="true">
        ✓
      </div>
      <h1 className="iv-done__title">{recap?.name} — recorded</h1>

      <div className="iv-done__recap">
        <Stamp
          tone={selected ? "selected" : "not_selected"}
          domains={domains}
        />
        <Pill track="payment" state={derivePaymentState(recap)} />
      </div>

      <div className="iv-done__action">
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          Next candidate
        </Button>
      </div>

      <img
        className="iv-done__lockup"
        src="/brand/wordmark-black.png"
        alt=""
        width="140"
      />
    </div>
  );
}
