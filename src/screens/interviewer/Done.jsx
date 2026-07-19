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
 * - Below the primary, ONLY while `canUndoVerdict`: a quiet 48px ghost
 *   "Undo verdict" (owner decision 2026-07-20 — the persistent button that
 *   replaced the 10 s undo toast). App.js owns the capability and clears
 *   it on any route away or any payment activity for the candidate; the
 *   tap just fires `onUndoVerdict`.
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

export default function Done({ recap, onNext, canUndoVerdict, onUndoVerdict }) {
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
  // §5 Track-1 (Phase 7a): prefer the explicit verdictStatus the submit latched;
  // fall back to the pre-Phase-7 array check when the recap carries no field.
  const selected = recap?.verdictStatus
    ? recap.verdictStatus === "selected"
    : domains.length > 0;

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
        {canUndoVerdict ? (
          <Button variant="ghost" size="md" fullWidth onClick={onUndoVerdict}>
            Undo verdict
          </Button>
        ) : null}
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
