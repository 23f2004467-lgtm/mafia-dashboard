// Pure candidate-payload builder extracted from App.js handleSubmit (Phase 0, landmine #1).
// MUST NOT import firebase, security.js, or App.js — this module is a pure mapping
// so it can be fixture-tested without auth or emulators.
//
// sanitizeInput below is a byte-identical copy of the chain
// FirebaseSecurity.validator.sanitizeInput -> SecurityUtils.sanitizeHTML
// (src/security.js). security.js cannot be imported here because it imports
// ./firebaseConfig at module top level. If security.js's sanitizeHTML ever
// changes, this copy must change with it (guarded by the fixture test).
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
 * @returns {object} the Firestore payload, byte-identical to the pre-extraction handleSubmit build.
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

  return {
    ...sanitizedData,
    lastUpdatedBy: meta.userEmail || "",
    lastUpdatedAt: meta.nowIso,
  };
}
