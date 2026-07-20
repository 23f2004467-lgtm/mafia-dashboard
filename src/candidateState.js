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
 * §5 Track-2 payment, INTERVIEWER + desk portal (owner 2026-07-20): a
 * TWO-STATE view — "paid" | "unpaid" — from the existing `paid` flag ALONE.
 * The board's verification (`manuallyVerified`) is an ADMIN concern that
 * interviewers never see (owner truth: their pill is just Paid or Unpaid).
 * "unpaid" renders AMBER on interviewer surfaces — "money outstanding,
 * collect it" — where the SAME amber on the admin three-state pill means
 * "an unverified claim". One color, a portal-scoped meaning (§5). The admin
 * portal keeps its own three-state derivation untouched.
 *
 * Pure; a missing/false `paid` → "unpaid" (permissive, never a gate).
 *
 * @param {object} candidate - a candidate doc / recap / form shape.
 * @returns {"paid"|"unpaid"}
 */
export function deriveInterviewerPayment(candidate) {
  return candidate && candidate.paid ? "paid" : "unpaid";
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
 * Check-in desk / waiting room (2026-07-20): is this candidate EXPLICITLY
 * checked in with NO verdict yet — i.e. sitting in the venue waiting to be
 * interviewed?
 *
 * ADDITIVE VIEW ONLY, never a gate (landmine #11 intact): docs without the
 * `activated` field simply are not "waiting" — they render permissively
 * everywhere else and nothing blocks them; they just don't appear in the
 * waiting-room list or the desk's "Waiting {N}" numerator. A candidate leaves
 * the waiting set the moment either verdict truth appears (explicit
 * `verdictStatus` or a non-empty verdict array) or their check-in is reverted.
 *
 * @param {object} candidate - a candidate doc shape.
 * @returns {boolean}
 */
export function isWaiting(candidate) {
  return (
    isCheckedIn(candidate) &&
    deriveJourneyState(candidate) === JOURNEY.CHECKED_IN
  );
}

/**
 * Waiting room (2026-07-20): the additive `activatedAt` check-in stamp as
 * epoch millis, or null. Every shape the field can arrive in is tolerated —
 * a Firestore Timestamp ({seconds, …}), an ISO string, a Date/millis — and
 * MISSING is a first-class answer (admin check-ins that predate the field,
 * or a serverTimestamp still in flight, both read null). Same coercion the
 * Desk screen's clock uses; pure, fixture-testable.
 *
 * @param {object} candidate - a candidate doc shape.
 * @returns {number|null} epoch millis, or null when absent/unparseable.
 */
export function activatedAtMillis(candidate) {
  const stamp = candidate && candidate.activatedAt;
  if (!stamp) return null;
  const d = stamp.seconds ? new Date(stamp.seconds * 1000) : new Date(stamp);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Waiting-room ordering (2026-07-20): activatedAt ASCENDING — the person
 * who has been sitting in the venue longest comes first. Docs with no
 * readable stamp sort LAST (an unknown wait never jumps the queue; a fresh
 * desk check-in whose serverTimestamp is still resolving correctly enters
 * at the end, then settles into place on the next snapshot). Ties and the
 * no-stamp tail fall back to name so the order is stable.
 *
 * @param {object} a - candidate doc shape.
 * @param {object} b - candidate doc shape.
 * @returns {number} standard comparator result.
 */
export function compareByActivatedAt(a, b) {
  const am = activatedAtMillis(a);
  const bm = activatedAtMillis(b);
  if (am !== bm) {
    if (am == null) return 1;
    if (bm == null) return -1;
    return am - bm;
  }
  return ((a && a.name) || "").localeCompare((b && b.name) || "");
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
