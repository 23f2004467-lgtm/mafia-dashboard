// Desk code — the shared short code that gates the check-in desk's name+code
// anonymous sign-in (owner feature 2026-07-20). The admin rotates it from the
// /admin "Check-in desk" Dialog; the desk types it once alongside their name.
//
// PURE module: no firebase, no App.js — generation FORMAT and comparison only,
// fixture/Jest-testable without auth (same discipline as candidateState.js /
// paymentClaim.js). The code only gates the ADDITIVE check-in write scope
// (rule-enforced in firestore.rules), so it is convenience-grade, not a secret.

// Unambiguous uppercase alphabet — no 0/O/1/I/L, so a code read off a laptop
// and typed on a phone at a loud venue can't be transcribed wrong.
const DESK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DESK_CODE_LENGTH = 6;

/**
 * A fresh desk code: `length` chars from the unambiguous alphabet. Prefers
 * crypto.getRandomValues when present, falling back to Math.random (the code
 * is not a secret — it gates only the additive check-in fields).
 *
 * @param {number} [length=DESK_CODE_LENGTH]
 * @returns {string} an uppercase code, e.g. "K7F2QJ".
 */
export function generateDeskCode(length = DESK_CODE_LENGTH) {
  const n = DESK_CODE_ALPHABET.length;
  const cryptoObj =
    typeof window !== "undefined" && window.crypto ? window.crypto : undefined;
  let out = "";
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i += 1) out += DESK_CODE_ALPHABET[buf[i] % n];
  } else {
    for (let i = 0; i < length; i += 1) {
      out += DESK_CODE_ALPHABET[Math.floor(Math.random() * n)];
    }
  }
  return out;
}

/**
 * Case-insensitive, whitespace-trimmed comparison of a typed code against the
 * stored one. Returns false whenever EITHER side is empty/absent — a missing
 * `deskCode` can never accidentally validate a blank entry (defence in depth
 * behind the firestore.rules scope).
 *
 * @param {string} typed - what the desk person entered.
 * @param {string} stored - config/checkinDesk.deskCode.
 * @returns {boolean}
 */
export function codesMatch(typed, stored) {
  const a = String(typed == null ? "" : typed).trim().toUpperCase();
  const b = String(stored == null ? "" : stored).trim().toUpperCase();
  return a.length > 0 && a === b;
}

export { DESK_CODE_ALPHABET, DESK_CODE_LENGTH };
