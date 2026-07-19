// Pure slot-import parsing for the admin "Import time slots…" flow (stage B
// of the desk feature, 2026-07-20). Mirrors the exportRows.js discipline:
// NO firebase imports, NO exceljs imports — this module must stay pure.
//
// AdminPortal.jsx owns the impure edges: it reads the picked file (ExcelJS
// `workbook.xlsx.load` for .xlsx, `parseCsv` below for .csv), flattens every
// cell to a string via `cellToString`, and hands `matchSlots` plain string
// rows plus the live candidates snapshot. What comes back is exactly what
// the preview Dialog states and the batched writes then apply: per matched
// candidate the ADDITIVE pair `slot` (display string) + `slotOrder`
// (sortable number, parsed best-effort — null when unparseable, in which
// case only `slot` is written and the desk sorts the row last). Nothing
// here touches the export mapping (exportRows.js) — landmines #9/#10.
//
// OWNER SAMPLE PENDING: the owner's real calling sheet has not been shared
// yet — every fixture in slotImport.test.js is synthetic. When the real
// sheet arrives, run it through the import preview once and extend the
// header/slot fixtures if its shapes surprise the autodetect.

// How many leading rows may precede the header (title banners, blank rows).
const HEADER_SCAN_ROWS = 10;

// ---------- CSV ----------

/**
 * Minimal RFC-4180-ish CSV parser: quoted fields, `""` escapes, commas and
 * newlines inside quotes, CRLF/LF, leading BOM. Returns rows of strings.
 * Hand-rolled on purpose — ExcelJS's csv module rides Node streams and the
 * brief forbids new deps; ~30 lines beats a polyfill.
 */
export function parseCsv(text) {
  const src = String(text == null ? "" : text).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- cell flattening ----------

const pad2 = (n) => String(n).padStart(2, "0");

/** Minutes-since-midnight → "9:30 AM" (the desk's 12-hour display idiom). */
const clockFromMinutes = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m % 60)} ${h24 < 12 ? "AM" : "PM"}`;
};

/**
 * Tolerant ExcelJS cell value → display string. Handles the value shapes
 * ExcelJS hands back: strings, numbers (an Excel time-of-day serial keeps
 * the clock in its fraction — 0.5 → "12:00 PM"; whole numbers stay digits,
 * so numeric reg numbers survive), Date (ExcelJS parses date-formatted
 * cells as UTC — UTC accessors, deliberately), richText runs, hyperlink
 * `{ text }`, formula `{ result }`, and error cells (→ "").
 */
export function cellToString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    const frac = value - Math.floor(value);
    if (value > 0 && frac > 0) return clockFromMinutes(frac * 24 * 60);
    return String(value);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return clockFromMinutes(value.getUTCHours() * 60 + value.getUTCMinutes());
  }
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (part && part.text) || "")
        .join("")
        .trim();
    }
    if (value.text != null) return cellToString(value.text); // hyperlink
    if (value.result !== undefined) return cellToString(value.result); // formula
    if (value.error != null) return ""; // error cell
    if (value.formula != null) return ""; // formula, no cached result
  }
  return String(value).trim();
}

// ---------- normalization ----------

/** "23bce · 7431" / "23BCE 7431" / " 23bce7431 " → "23BCE7431". */
export const normalizeRegNo = (value) =>
  String(value == null ? "" : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Case/punctuation/whitespace-insensitive name key for the fuzzy fallback. */
export const normalizeName = (value) =>
  String(value == null ? "" : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ---------- slot order (best-effort) ----------

const meridiemOf = (raw) => (raw ? raw.toLowerCase().replace(/\./g, "") : null);

const toMinutes = (hh, mm, mer) => {
  let h = Number(hh);
  const min = Number(mm);
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59) return null;
  const meridiem = meridiemOf(mer);
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return h * 60 + min;
};

/**
 * Slot display string → sortable number, best-effort. Contract: MONOTONE
 * within one sheet's format, not semantic minutes. Tries in order:
 *   1. hour+minutes ("9:30", "10.15 pm", "9:00 AM – 9:30 AM" → the start)
 *   2. bare hour + meridiem ("9 AM", "2pm")
 *   3. any number ("Slot 3" → 3, "0930" → 930 — indexes sort fine too)
 * Nothing parseable → null (the desk then sorts the row last, by name).
 */
export function parseSlotOrder(slotText) {
  const s = String(slotText == null ? "" : slotText).trim();
  if (!s) return null;
  let m = s.match(/(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (m) {
    const v = toMinutes(m[1], m[2], m[3]);
    if (v != null) return v;
  }
  m = s.match(/(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i);
  if (m) {
    const v = toMinutes(m[1], "0", m[2]);
    if (v != null) return v;
  }
  m = s.match(/\d+/);
  if (m) return Number(m[0]);
  return null;
}

// ---------- column autodetect ----------

/**
 * Scan the first HEADER_SCAN_ROWS rows for a header row carrying BOTH a
 * reg-number column and a slot column (different cells). Tolerance per the
 * brief: regNo header ~ /reg|registration|id/i, slot header ~ /slot|time/i.
 * Two passes so the SPECIFIC headers claim first — "Slot" beats a
 * "Timestamp" column, "Reg No" beats a stray "ID"; /time/ and /\bid\b/ are
 * fallbacks only. A "Name" column, when present, feeds the fuzzy fallback.
 * Returns { headerIndex, regNoCol, slotCol, nameCol } or null.
 */
export function detectColumns(rows) {
  const scan = Math.min(rows.length, HEADER_SCAN_ROWS);
  for (let r = 0; r < scan; r += 1) {
    const row = rows[r] || [];
    let regNoCol = null;
    let slotCol = null;
    let nameCol = null;
    row.forEach((cell, i) => {
      const h = String(cell == null ? "" : cell).trim();
      if (!h) return;
      if (regNoCol == null && /reg/i.test(h)) regNoCol = i;
      if (slotCol == null && i !== regNoCol && /slot/i.test(h)) slotCol = i;
      if (nameCol == null && /name/i.test(h)) nameCol = i;
    });
    row.forEach((cell, i) => {
      const h = String(cell == null ? "" : cell).trim();
      if (!h) return;
      if (regNoCol == null && i !== slotCol && /\bid\b/i.test(h)) regNoCol = i;
      if (slotCol == null && i !== regNoCol && /time/i.test(h)) slotCol = i;
    });
    if (regNoCol != null && slotCol != null && regNoCol !== slotCol) {
      return { headerIndex: r, regNoCol, slotCol, nameCol };
    }
  }
  return null;
}

// Unique sentinel: a normalized name shared by 2+ candidates can never be
// a fuzzy-fallback target (matching the wrong student is worse than an
// unmatched row the admin can chase by hand).
const AMBIGUOUS = Symbol("ambiguous-name");

// ---------- the matcher ----------

/**
 * The whole import, pure: string rows (from parseCsv or the ExcelJS
 * flatten) + the live candidates → exactly what will be written.
 *
 * Rules:
 * - header autodetect via detectColumns; no detectable header → { ok:false }.
 * - rows match by normalized regNo; miss → fuzzy name fallback, UNIQUE
 *   normalized-name matches only (ambiguous names never match).
 * - fully blank identity rows are decoration — skipped silently.
 * - a matched person with an empty slot cell writes nothing (emptySlot).
 * - duplicate targets: LAST wins, every overwrite counted (duplicates).
 * - docKey = cand.id || cand.regNo (landmine #2 — the same key every
 *   existing write path uses; admin snapshot docs carry no `id`, so it
 *   falls through to regNo exactly like the admin verify/check-in writes).
 *
 * Returns { ok, error?, columns?, matched, unmatched, duplicates,
 *           emptySlot, unparsedOrder } where matched entries are
 * { docKey, regNo, name, slot, slotOrder|null }.
 */
export function matchSlots(rows, candidates) {
  const columns = detectColumns(rows || []);
  if (!columns) {
    return {
      ok: false,
      error:
        "Couldn't find the columns — the sheet needs a reg-number header (reg / registration / id) and a slot header (slot / time).",
      matched: [],
      unmatched: [],
      duplicates: 0,
      emptySlot: 0,
      unparsedOrder: 0,
    };
  }
  const { headerIndex, regNoCol, slotCol, nameCol } = columns;

  const byRegNo = new Map();
  const byName = new Map();
  for (const cand of candidates || []) {
    const reg = normalizeRegNo(cand.regNo);
    if (reg && !byRegNo.has(reg)) byRegNo.set(reg, cand);
    const name = normalizeName(cand.name);
    if (name) byName.set(name, byName.has(name) ? AMBIGUOUS : cand);
  }

  const out = new Map(); // docKey → entry; dupes overwrite (last wins)
  const unmatched = [];
  let duplicates = 0;
  let emptySlot = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const regRaw = String((row && row[regNoCol]) ?? "").trim();
    const nameRaw =
      nameCol != null ? String((row && row[nameCol]) ?? "").trim() : "";
    const slotText = String((row && row[slotCol]) ?? "").trim();
    if (!regRaw && !nameRaw) continue; // blank/decoration row

    let cand = byRegNo.get(normalizeRegNo(regRaw)) || null;
    if (!cand && nameRaw) {
      const viaName = byName.get(normalizeName(nameRaw));
      if (viaName && viaName !== AMBIGUOUS) cand = viaName;
    }
    if (!cand) {
      unmatched.push({ regNo: regRaw, name: nameRaw, slot: slotText });
      continue;
    }
    if (!slotText) {
      emptySlot += 1;
      continue;
    }

    const docKey = cand.id || cand.regNo;
    if (out.has(docKey)) duplicates += 1;
    out.set(docKey, {
      docKey,
      regNo: cand.regNo,
      name: cand.name || cand.regNo,
      slot: slotText,
      slotOrder: parseSlotOrder(slotText),
    });
  }

  const matched = Array.from(out.values());
  return {
    ok: true,
    columns,
    matched,
    unmatched,
    duplicates,
    emptySlot,
    unparsedOrder: matched.filter((entry) => entry.slotOrder == null).length,
  };
}
