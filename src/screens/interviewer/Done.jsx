import React from "react";
import {
  Banner,
  Button,
  CelebrationCheck,
  Pill,
  Stamp,
  prefersReducedMotion,
} from "../../ui";
import { deriveInterviewerPayment } from "../../candidateState";
import "./Done.css";

/**
 * Done — the §6.5 recap screen, recomposed as a printed artifact (the
 * celebration pass, owner 2026-07-20): white paper kept, receipt craft —
 * mark + name as the header, a hairline rule, the verdict body (Stamp +
 * payment pill), a dashed perforation, then the tear-off actions and the
 * wordmark as the printed footer. Presentational: App.js latches the
 * recap ({name, verdict, verdictStatus, paid, manuallyVerified}) BEFORE
 * the routed reset wipes the form, then routes here.
 *
 * Outcome-mapped intensity (hard rule):
 * - SELECTED → the mild echo of the green room: the drawn tick (brisk),
 *   staggered rises, the stamp SLAM (rotation overshoot, one-shot), five
 *   spectrum flecks drifting once. Never confetti — that belongs to the
 *   green room alone.
 * - NOT SELECTED → zero festivity: the ✓ becomes a neutral ink "recorded"
 *   mark (complete, static), the stamp enters quiet (opacity only), no
 *   rises, no flecks. A rejected student's record gets gravity.
 * - Reduced motion → everything static; flecks never render.
 *
 * - The verdict Stamp (§11.5, this screen ONLY — §2 #47): EVERY selected
 *   domain across both committees joined with "+", wrapping when long;
 *   or "NOT SELECTED" (empty arrays — the §2 #30 display-local state).
 * - Payment pill (§5 track 2, from the latched paid/manuallyVerified).
 * - AMBER TRUTH BANNER (owner 2026-07-20): STATE-based, not path-based —
 *   whenever the recap is a SELECTED verdict whose payment is UNPAID, a
 *   tone="warning" Banner "Verdict saved · payment not received" sits above
 *   the pill. NEVER for a paid state (any paid reads as received to the
 *   interviewer) or for not_selected. Payment stays admin-corrected — this
 *   banner is only the honest flag, never a control.
 * - One 56px primary "Next candidate" → Search, cleared, autofocused
 *   (§2 #45: the ONLY route that autofocuses Search).
 * - Below the primary, ONLY while `canUndoVerdict`: a quiet 48px ghost
 *   "Undo verdict" (owner decision 2026-07-20 — the persistent button that
 *   replaced the 10 s undo toast). App.js owns the capability and clears
 *   it on any route away or any payment activity for the candidate; the
 *   tap just fires `onUndoVerdict`.
 * - ALWAYS beneath that: a quiet ghost "Edit verdict" (owner 2026-07-20) —
 *   fires `onEditVerdict`, which routes back to the Candidate screen for a
 *   clean resubmit (the resubmit PRESERVES payment). Applies on not_selected
 *   too (a mis-reject is editable). Undo reverts the write; Edit goes to
 *   change it. Order under the primary: Undo (when alive), then Edit.
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

/** The five Done flecks — deterministic (positions/delays in Done.css),
 *  spectrum tokens, one drift each, all gone ≤ 1.75s. Decoration only. */
const FLECKS = ["red", "amber", "green", "blue", "violet"];

export default function Done({
  recap,
  onNext,
  canUndoVerdict,
  onUndoVerdict,
  onEditVerdict,
}) {
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
  const celebrate = selected && !prefersReducedMotion();
  // §5 Track 2 (interviewer two-state) — the pill state feeds both the pill
  // and the amber banner; "unpaid" is the only non-paid value.
  const paymentState = deriveInterviewerPayment(recap);
  // The amber truth banner (owner 2026-07-20): a SELECTED verdict recorded
  // while payment is still UNPAID. State-based — shown for no other combo
  // (paid_unverified/verified read as received; not_selected is never here).
  const showUnpaidWarning = selected && paymentState === "unpaid";

  return (
    <div
      className={
        "iv-done " + (selected ? "iv-done--celebrate" : "iv-done--quiet")
      }
    >
      {celebrate ? (
        <div className="iv-done__flecks celebrate-once" aria-hidden="true">
          {FLECKS.map((color) => (
            <i
              key={color}
              className={"iv-done__fleck iv-done__fleck--" + color}
            />
          ))}
        </div>
      ) : null}

      {/* The APPROVED seal (owner 2026-07-20): a pressed rubber stamp on the
          receipt — SELECTED ONLY. You never stamp APPROVED on a rejection,
          so it is absent on the not_selected recap. Decorative; the outcome
          is already announced by the Stamp + title. */}
      {selected ? (
        <img
          className="iv-done__approved celebrate-once"
          src="/brand/approved-stamp.png"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      ) : null}

      {/* The mark: SELECTED draws the tick (the green room's echo, brisk);
          NOT SELECTED renders it complete in neutral ink — recorded, not
          celebrated. */}
      <CelebrationCheck
        size={88}
        tone={selected ? "success" : "neutral"}
        drawn={selected}
        tempo="brisk"
      />
      <h1 className="iv-done__title celebrate-once">
        {recap?.name} — recorded
      </h1>

      <div
        className="iv-done__rule iv-done__rule--head celebrate-once"
        aria-hidden="true"
      />

      <div className="iv-done__recap">
        <Stamp
          tone={selected ? "selected" : "not_selected"}
          domains={domains}
          entrance={selected ? "slam" : "quiet"}
        />
        {showUnpaidWarning ? (
          <div className="iv-done__warning">
            <Banner tone="warning">
              Verdict saved · payment not received
            </Banner>
          </div>
        ) : null}
        <div className="iv-done__pill celebrate-once">
          <Pill track="paymentIv" state={paymentState} />
        </div>
      </div>

      <div
        className="iv-done__rule iv-done__rule--perf celebrate-once"
        aria-hidden="true"
      />

      <div className="iv-done__action celebrate-once">
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          Next candidate
        </Button>
        {canUndoVerdict ? (
          <Button variant="ghost" size="md" fullWidth onClick={onUndoVerdict}>
            Undo verdict
          </Button>
        ) : null}
        <Button variant="ghost" size="md" fullWidth onClick={onEditVerdict}>
          Edit verdict
        </Button>
      </div>

      <img
        className="iv-done__lockup celebrate-once"
        src="/brand/wordmark-black.png"
        alt=""
        width="140"
      />
    </div>
  );
}
