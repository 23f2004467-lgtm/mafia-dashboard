// Jest coverage for the §7.5 drawer payment-block "manual" tag derivation —
// a pure predicate over paymentDetails.method (no manual txn-id prefix
// exists in the surviving write paths, so the method string is the only
// signal).

import { isManualPayment } from "./AdminCandidateDrawer";

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
