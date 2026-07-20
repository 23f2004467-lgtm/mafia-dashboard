// Jest coverage for the §7.5 drawer payment-block "manual" tag derivation —
// a pure predicate over paymentDetails.method (no manual txn-id prefix
// exists in the surviving write paths, so the method string is the only
// signal).

import { isManualPayment, deriveMethodTag } from "./AdminCandidateDrawer";

describe("isManualPayment (§7.5 amber manual tag)", () => {
  test("true for the surviving manual mark-paid write (method 'Manual')", () => {
    expect(
      isManualPayment({ method: "Manual", timestamp: "2026-07-18T10:30:00.000Z" })
    ).toBe(true);
  });

  test("case-insensitive on legacy casings", () => {
    expect(isManualPayment({ method: "manual payment" })).toBe(true);
  });

  test("false for QR confirmations ('{type} QR ({name})')", () => {
    expect(isManualPayment({ method: "Personal QR (MAFIA Club)" })).toBe(false);
  });

  test("false for other legacy method strings", () => {
    expect(isManualPayment({ method: "cash" })).toBe(false);
  });

  test("false when method is missing", () => {
    expect(isManualPayment({ amount: 300 })).toBe(false);
  });

  test("false when paymentDetails is null/undefined", () => {
    expect(isManualPayment(null)).toBe(false);
    expect(isManualPayment(undefined)).toBe(false);
  });
});

// The tag TEXT (owner 2026-07-20): the word "manual" is purged from the UI —
// the amber tag names the actual method instead. Stored method VALUES are
// untouched; this derivation is display copy only.
describe("deriveMethodTag (§7.5 payment-method tag — 'manual' purged)", () => {
  test("the bare hand-confirm (method 'Manual') strips to the UPI default", () => {
    expect(deriveMethodTag({ method: "Manual" })).toBe("UPI");
  });

  test("never surfaces the word 'manual' for legacy casings", () => {
    expect(deriveMethodTag({ method: "manual payment" })).toBe("payment");
    expect(deriveMethodTag({ method: "Manual" })).not.toMatch(/manual/i);
  });

  test("an explicit cash confirm reads 'Cash' (owner truth #4)", () => {
    expect(deriveMethodTag({ method: "Cash" })).toBe("Cash");
    expect(deriveMethodTag({ method: "cash received" })).toBe("Cash");
  });

  test("a real method string passes through untouched", () => {
    expect(deriveMethodTag({ method: "Personal QR (MAFIA Club)" })).toBe(
      "Personal QR (MAFIA Club)"
    );
  });

  test("null when there is no method", () => {
    expect(deriveMethodTag({ amount: 300 })).toBe(null);
    expect(deriveMethodTag(null)).toBe(null);
    expect(deriveMethodTag(undefined)).toBe(null);
  });
});
