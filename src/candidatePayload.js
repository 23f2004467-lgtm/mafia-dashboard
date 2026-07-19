// Pure candidate-payload builder extracted from App.js handleSubmit (Phase 0, landmine #1).
// MUST NOT import firebase, security.js, or App.js — this module is a pure mapping
// so it can be fixture-tested without auth or emulators.
//
// sanitizeInput below is a byte-identical copy of the chain
// FirebaseSecurity.validator.sanitizeInput -> SecurityUtils.sanitizeHTML
// (src/security.js). security.js cannot be imported here because it imports
// ./firebaseConfig at module top level. If security.js's sanitizeHTML ever
// changes, this copy must change with it (guarded by the fixture test).
//
// candidateState.js is a sibling PURE module (no firebase) — safe to import;
// it centralizes the §5 verdictStatus derivation (Phase 7a).
import { deriveVerdictStatusForWrite } from './candidateState';
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

/**
 * Builds the exact object handleSubmit passes to setDoc(doc(db, "candidates", docKey), payload).
 *
 * @param {object} formData - the live formData state object (already validated by
 *   FirebaseSecurity.validator.validateCandidateData in handleSubmit before this is called).
 * @param {object} meta - every nondeterministic input, supplied by the caller:
 *   @param {string} meta.docKey - the Firestore doc key (formData.regNo at call time).
 *     Not part of the payload itself; carried so callers/tests pin the key alongside the payload.
 *   @param {string} meta.nowIso - new Date().toISOString() at call time.
 *   @param {string|undefined} meta.userEmail - user?.email at call time.
 *   @param {boolean|undefined} meta.notSelected - Phase 7a: the explicit
 *     "Not selected — no committees" flag from the verdict screen. Only used
 *     to derive the additive `verdictStatus`; never persisted as its own field.
 * @returns {object} the Firestore payload. Byte-identical to the pre-extraction
 *   handleSubmit build EXCEPT the additive, optional `verdictStatus` (Phase 7a,
 *   §2 #29/#30): present only when there is a real verdict decision, absent
 *   otherwise so old docs stay field-less. Every other field is untouched.
 */
export function buildCandidatePayload(formData, meta) {
  const sanitizedData = {
    ...formData,
    name: sanitizeInput(formData.name),
    regNo: sanitizeInput(formData.regNo),
    college: formData.college ? sanitizeInput(formData.college) : '',
    branch: formData.branch ? sanitizeInput(formData.branch) : '',
    comments: formData.comments ? sanitizeInput(formData.comments) : ''
  };

  const payload = {
    ...sanitizedData,
    lastUpdatedBy: meta.userEmail || "",
    lastUpdatedAt: meta.nowIso,
  };

  // Phase 7a additive field (§5 Track-1). Written alongside the existing
  // verdict arrays, never replacing them. A real verdict decision OVERRIDES any
  // value spread in from a loaded doc; when there is no decision the key is left
  // exactly as-is (never forced to `undefined` — Firestore rejects that, and
  // never stripped — that would drop a loaded doc's existing status). Old docs
  // therefore stay field-less until an interviewer makes a decision.
  const verdictStatus = deriveVerdictStatusForWrite(formData.verdict, meta.notSelected);
  if (verdictStatus) {
    payload.verdictStatus = verdictStatus;
  }

  return payload;
}
