// The mark-paid write-shape guard (Stage C — cash mode, owner 2026-07-20).
// buildPaymentClaim is the entire paymentDetails mapping confirmManualPaid
// persists, so pinning it here proves the write shape on the hold-to-confirm
// path — the analogue of candidate-payload.json for the submit path.
import { buildPaymentClaim } from "./paymentClaim";

const CASH = { id: "cash", name: "Cash", type: "Collected in person", cash: true };
const UPI = { id: "bhutakeyur0208@okhdfcbank", name: "Bhuta's UPI", type: "HDFC Bank" };
const ISO = "2026-07-20T12:00:00.000Z";

describe("buildPaymentClaim — the hold-to-confirm mark-paid claim", () => {
  test('cash rail → { method: "Cash", timestamp }, no bank identity', () => {
    expect(buildPaymentClaim(CASH, ISO)).toEqual({
      method: "Cash",
      timestamp: ISO,
    });
  });

  test("cash claim carries NO upiId — the Phase-8 reconciliation tell", () => {
    // A cash claim never appears on a bank statement; the absence of a upiId
    // (with method "Cash") is exactly how Phase 8 must exclude it from the
    // "no bank credit found" fraud list. Locking it so that stays true.
    const claim = buildPaymentClaim(CASH, ISO);
    expect(claim.upiId).toBeUndefined();
    expect(claim.method).toBe("Cash");
  });

  test("a UPI account → method is the account label + the account identity", () => {
    expect(buildPaymentClaim(UPI, ISO)).toEqual({
      method: "Bhuta's UPI",
      upiId: "bhutakeyur0208@okhdfcbank",
      upiName: "Bhuta's UPI",
      upiType: "HDFC Bank",
      timestamp: ISO,
    });
  });

  test('never stamps the retired "manual" noise word', () => {
    expect(buildPaymentClaim(CASH, ISO).method).not.toMatch(/manual/i);
    expect(buildPaymentClaim(UPI, ISO).method).not.toMatch(/manual/i);
  });

  test("pure + deterministic — same inputs, equal output", () => {
    expect(buildPaymentClaim(UPI, ISO)).toEqual(buildPaymentClaim(UPI, ISO));
    expect(buildPaymentClaim(CASH, ISO)).toEqual(buildPaymentClaim(CASH, ISO));
  });
});
