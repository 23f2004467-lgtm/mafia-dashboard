/**
 * deskCode — the desk sign-in code generator + comparator (owner feature
 * 2026-07-20). Pure module, no firebase: this pins the FORMAT (length,
 * unambiguous charset) the admin rotate writes and the case-insensitive,
 * trimmed match the desk login validates with.
 */
import {
  generateDeskCode,
  codesMatch,
  DESK_CODE_ALPHABET,
  DESK_CODE_LENGTH,
} from "./deskCode";

describe("generateDeskCode", () => {
  test("defaults to 6 chars, all from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateDeskCode();
      expect(code).toHaveLength(DESK_CODE_LENGTH);
      for (const ch of code) {
        expect(DESK_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  test("never emits the ambiguous glyphs 0 O 1 I L", () => {
    const joined = Array.from({ length: 300 }, () => generateDeskCode()).join("");
    expect(joined).not.toMatch(/[0O1IL]/);
  });

  test("honours an explicit length", () => {
    expect(generateDeskCode(8)).toHaveLength(8);
    expect(generateDeskCode(4)).toHaveLength(4);
  });

  test("is effectively unique across generations (not a constant)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateDeskCode()));
    // Collisions are astronomically unlikely; more than one distinct value
    // proves it is not returning a fixed string.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("codesMatch", () => {
  test("matches case-insensitively and trims whitespace", () => {
    expect(codesMatch("k7f2qj", "K7F2QJ")).toBe(true);
    expect(codesMatch("  K7F2QJ  ", "K7F2QJ")).toBe(true);
    expect(codesMatch("K7F2QJ", "k7f2qj")).toBe(true);
  });

  test("rejects a mismatch", () => {
    expect(codesMatch("K7F2QJ", "K7F2QK")).toBe(false);
  });

  test("an empty or absent side never matches (no blank-passes-blank)", () => {
    expect(codesMatch("", "")).toBe(false);
    expect(codesMatch("   ", "K7F2QJ")).toBe(false);
    expect(codesMatch("K7F2QJ", "")).toBe(false);
    expect(codesMatch(null, null)).toBe(false);
    expect(codesMatch(undefined, "K7F2QJ")).toBe(false);
    expect(codesMatch("K7F2QJ", undefined)).toBe(false);
  });
});
