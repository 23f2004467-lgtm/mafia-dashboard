// Pure builder for the interviewer hold-to-confirm mark-paid claim
// (paymentDetails), extracted from App.js confirmManualPaid so the write
// shape is fixture-testable without firebase (same discipline as
// candidatePayload.js / exportRows.js — no firebase, no security.js, no App.js).
//
// Cash mode (owner truth #4, 2026-07-20): the Payment ACCOUNT zone now offers
// Cash alongside the two UPI rails. Every payment is human-confirmed (owner
// truth #2 — there is no automatic gateway confirmation), so the claim records
// WHICH rail collected the fee instead of the retired "manual" noise word:
//   - Cash          → { method: "Cash", timestamp }
//   - a UPI account → { method: <account label>, upiId, upiName, upiType, timestamp }
// This is ADDITIVE to the pre-cash write (a bare { method, timestamp }): the
// method now names the real rail, and the UPI branch carries the account's
// identity (mirroring the QR-confirm shape) so the admin drawer can render
// "UPI · {account}" and the board knows which handle to reconcile against.
//
// The result is always the amber "paid · unverified" claim on the admin
// three-state pill (the interviewer sees only "Paid", §5 Track 2) — the board
// still verifies EVERY claim, cash included.

/**
 * @param {object} account - the selected ACCOUNT-zone rail. Either a UPI entry
 *   ({ id, name, type }) or the Cash sentinel ({ cash: true, name: "Cash", … }).
 * @param {string} nowIso - new Date().toISOString() at confirm time, passed in
 *   by the caller so this builder stays pure and deterministic.
 * @returns {object} the paymentDetails object to persist on the candidate doc.
 */
export function buildPaymentClaim(account, nowIso) {
  if (account && account.cash) {
    // RECONCILIATION BREADCRUMB (Phase 8 — no code here, owner 2026-07-20; see
    // DESIGN.md §4 "Payment rails and reconciliation"): a cash claim never
    // lands on a bank statement. When bank-statement reconciliation ships,
    // cash-method claims MUST be EXCLUDED from the "no bank credit found" fraud
    // list (their absence is expected, not suspicious) and verified by physical
    // cash-count instead. The tell is method === "Cash" AND the absence of a
    // upiId (below, the UPI branch is the only one that stamps upiId).
    return { method: "Cash", timestamp: nowIso };
  }
  return {
    method: account.name,
    upiId: account.id,
    upiName: account.name,
    upiType: account.type,
    timestamp: nowIso,
  };
}
