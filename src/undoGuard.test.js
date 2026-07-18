// Jest coverage for the §2 #12 undo stale-check predicate (required by the
// §14 Phase 3 checklist: "the undo stale-check is verified by unit test —
// extract the guard as a pure predicate over captured vs fresh
// lastUpdatedAt/lastUpdatedBy and Jest both branches").

import { canUndo } from "./undoGuard";

const written = {
  lastUpdatedAt: "2026-07-18T10:15:30.000Z",
  lastUpdatedBy: "interviewer@example.com",
};

describe("canUndo (undo stale-check, §2 #12)", () => {
  test("passes when the fresh doc still carries exactly the meta our write stamped", () => {
    expect(canUndo(written, { ...written })).toBe(true);
  });

  test("aborts when another user wrote in between (different lastUpdatedAt)", () => {
    expect(
      canUndo(written, {
        lastUpdatedAt: "2026-07-18T10:15:31.000Z",
        lastUpdatedBy: "interviewer@example.com",
      })
    ).toBe(false);
  });

  test("aborts when another user wrote in between (different lastUpdatedBy)", () => {
    expect(
      canUndo(written, {
        lastUpdatedAt: "2026-07-18T10:15:30.000Z",
        lastUpdatedBy: "someone.else@example.com",
      })
    ).toBe(false);
  });

  test("aborts when the fresh doc is missing (deleted between write and undo)", () => {
    expect(canUndo(written, null)).toBe(false);
  });

  test("aborts when no captured meta exists (defensive: never undo blind)", () => {
    expect(canUndo(null, { ...written })).toBe(false);
  });
});
