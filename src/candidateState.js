// §5 candidate-state — the single source of truth for the Track-1 Journey
// derivation, shared pixel-identically by both portals (Phase 7a).
//
// PURE module: no firebase, no security.js, no App.js — fixture/Jest-testable
// without auth or emulators (same discipline as candidatePayload.js).
//
// THE GOLDEN RULE (landmine #11): the Phase-7 fields `verdictStatus` and
// `activated` are ADDITIVE and OPTIONAL. Old candidate docs have NEITHER.
// A missing field ALWAYS renders the permissive state — nothing here may ever
// return a state that blocks, dims, or hides a candidate for lacking a field:
//   - missing `activated`     → treat as checked-in (permissive), never Registered
//   - missing `verdictStatus` → derive from the existing verdict arrays exactly
//                               as the app did pre-Phase-7 (empty arrays →
//                               checked-in/unseen, NEVER "not selected")

// The four journey Pill state keys (must match src/ui/Pill.jsx TRACKS.journey).
export const JOURNEY = {
  REGISTERED: "registered",
  CHECKED_IN: "checked_in",
  SELECTED: "selected",
  NOT_SELECTED: "not_selected",
};

/** True when either committee's verdict array carries at least one domain.
 *  This is the EXACT pre-Phase-7 "is selected" test, centralized. */
export function hasAnyDomain(verdict) {
  if (!verdict || typeof verdict !== "object") return false;
  const talent = Array.isArray(verdict.talentComm) ? verdict.talentComm.length : 0;
  const work = Array.isArray(verdict.workComm) ? verdict.workComm.length : 0;
  return talent + work > 0;
}

/**
 * §5 Track-1 Journey derivation — the single source of truth.
 *
 * Precedence (§5 Phase-7 column, with the permissive pre-Phase-7 fallback):
 *   1. `verdictStatus` when the field EXISTS on the doc — the explicit Phase-7
 *      truth: "selected" | "not_selected".
 *   2. otherwise the EXACT pre-Phase-7 array-based derivation: any verdict
 *      domain → Selected.
 *   3. `activated === false` (explicit only) → Registered.
 *   4. default (field absent OR true, no verdict) → the permissive "Checked in".
 *
 * Old docs (no verdictStatus, no activated) fall straight through to steps 2/4
 * and behave byte-identically to the pre-Phase-7 app. Empty arrays with no
 * verdictStatus render "Checked in" — NEVER "Not selected" (that distinction is
 * only knowable from the explicit field on new docs).
 *
 * @param {object} candidate - a candidate doc (or recap) shape.
 * @returns {string} one of the JOURNEY keys / Pill journey state keys.
 */
export function deriveJourneyState(candidate) {
  const c = candidate || {};

  // (1) Explicit Phase-7 verdictStatus wins WHEN PRESENT.
  if (c.verdictStatus === JOURNEY.SELECTED) return JOURNEY.SELECTED;
  if (c.verdictStatus === JOURNEY.NOT_SELECTED) return JOURNEY.NOT_SELECTED;

  // (2) Pre-Phase-7 fallback: derive Selected from the verdict arrays.
  if (hasAnyDomain(c.verdict)) return JOURNEY.SELECTED;

  // (3) Registered ONLY when activated is explicitly false (never pre-Phase-7).
  //     A missing `activated` never lands here — permissive by construction.
  if (c.activated === false) return JOURNEY.REGISTERED;

  // (4) Permissive default.
  return JOURNEY.CHECKED_IN;
}

/**
 * §5 stat-tile numerator (Phase 7b): is this candidate EXPLICITLY checked in?
 *
 * ONLY `activated === true` counts. A missing field is permissive for OPERATION
 * (deriveJourneyState renders it "Checked in", nothing blocks) but it is NOT an
 * explicit check-in — an old doc that predates the venue check-in flow was never
 * scanned at the door, so it must not inflate the "Checked in X/Y" numerator.
 * `activated === false` (explicitly Registered, not yet arrived) is also false.
 *
 * This keeps the tile HONEST: X = people the board actually checked in.
 *
 * @param {object} candidate - a candidate doc shape.
 * @returns {boolean}
 */
export function isCheckedIn(candidate) {
  return Boolean(candidate) && candidate.activated === true;
}

/**
 * Phase-7 WRITE helper: the additive `verdictStatus` the verdict-submit payload
 * should carry, or `undefined` when the field must stay ABSENT.
 *
 *   - any domain chosen across either committee → "selected"
 *   - the explicit "Not selected — no committees" path → "not_selected"
 *   - neither (no verdict decision) → undefined  ⇒ caller omits the key entirely
 *
 * Domains take precedence over the flag (they are mutually exclusive by UI, but
 * "selected" is the safe winner). Returning undefined — never a written value —
 * keeps the field additive/optional: the app never persists a state the UI
 * cannot justify, and old docs stay field-less until a real decision is made.
 *
 * @param {object} verdict - the verdict arrays ({talentComm, workComm}).
 * @param {boolean} notSelected - the explicit in-session "Not selected" flag.
 * @returns {"selected"|"not_selected"|undefined}
 */
export function deriveVerdictStatusForWrite(verdict, notSelected) {
  if (hasAnyDomain(verdict)) return JOURNEY.SELECTED;
  if (notSelected) return JOURNEY.NOT_SELECTED;
  return undefined;
}
