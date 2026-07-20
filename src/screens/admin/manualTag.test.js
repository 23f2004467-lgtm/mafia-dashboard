// Jest coverage for the §7.5 drawer payment-block "manual" tag derivation —
// a pure predicate over paymentDetails.method (no manual txn-id prefix
// exists in the surviving write paths, so the method string is the only
// signal).

import {
  isManualPayment,
  deriveMethodTag,
  deriveMethodLabel,
  showsRailTag,
} from "./AdminCandidateDrawer";

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

// The drawer's plain Method-row label (owner 2026-07-20, Stage C — cash mode):
// names the collection rail as "Cash" or "UPI · {account}", never the retired
// "manual" and never the internal "QR" method string. Display copy only —
// stored `paymentDetails.method` VALUES are untouched.
describe("deriveMethodLabel (§7.5 drawer Method row — cash mode)", () => {
  test("an explicit cash confirm reads 'Cash'", () => {
    expect(deriveMethodLabel({ method: "Cash", timestamp: "t" })).toBe("Cash");
    expect(deriveMethodLabel({ method: "cash received" })).toBe("Cash");
  });

  test("a UPI hold-confirm reads 'UPI · {account}' from the carried identity", () => {
    expect(
      deriveMethodLabel({
        method: "Bhuta's UPI",
        upiId: "bhutakeyur0208@okhdfcbank",
        upiName: "Bhuta's UPI",
        upiType: "HDFC Bank",
      })
    ).toBe("UPI · Bhuta's UPI");
  });

  test("the vestigial QR-confirm claim collapses to plain 'UPI · {account}' — no 'QR', no 'manual'", () => {
    const label = deriveMethodLabel({
      method: "Personal QR (MAFIA Club)",
      upiName: "MAFIA Club",
    });
    expect(label).toBe("UPI · MAFIA Club");
    expect(label).not.toMatch(/qr/i);
    expect(label).not.toMatch(/manual/i);
  });

  test("a legacy bare hand-confirm (method 'Manual', no UPI identity) → the default rail 'UPI'", () => {
    const label = deriveMethodLabel({ method: "Manual" });
    expect(label).toBe("UPI");
    expect(label).not.toMatch(/manual/i);
  });

  test("null when there is neither a method nor an account", () => {
    expect(deriveMethodLabel({ amount: 300 })).toBe(null);
    expect(deriveMethodLabel(null)).toBe(null);
    expect(deriveMethodLabel(undefined)).toBe(null);
  });
});

// The render gate for the amber rail tag next to the pill (Stage C BROADENS
// Stage B's /manual/ gate): every HUMAN-confirmed rail surfaces the tag —
// Cash, a UPI account hold-confirm, the legacy bare hand-confirm — while the
// vestigial QR auto-confirm path (method carries "QR") stays untagged.
describe("showsRailTag (§7.5 amber rail-tag gate — cash mode)", () => {
  test("true for every human-confirmed rail: Cash, a UPI account, legacy 'Manual'", () => {
    expect(showsRailTag({ method: "Cash" })).toBe(true);
    expect(showsRailTag({ method: "Bhuta's UPI" })).toBe(true);
    expect(showsRailTag({ method: "Manual" })).toBe(true);
  });

  test("false for the QR auto-confirm path (stays untagged, exactly as Stage B)", () => {
    expect(showsRailTag({ method: "Personal QR (MAFIA Club)" })).toBe(false);
    expect(showsRailTag({ method: "business qr (club)" })).toBe(false);
  });

  test("false when method is missing or paymentDetails is null/undefined", () => {
    expect(showsRailTag({ amount: 300 })).toBe(false);
    expect(showsRailTag(null)).toBe(false);
    expect(showsRailTag(undefined)).toBe(false);
  });
});
