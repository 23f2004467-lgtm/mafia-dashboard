// Stage B (time-slot layer, 2026-07-20): unit tests for the PURE slot-import
// parser. SYNTHETIC FIXTURES ONLY — the owner's real calling sheet is still
// pending; when it arrives, run it through the admin preview once and extend
// these fixtures if its header/slot shapes surprise the autodetect.
// The export mapping is untouched by this feature — exportRows.test.js is
// the guard that stays green (landmines #9/#10).

import {
  parseCsv,
  cellToString,
  normalizeRegNo,
  parseSlotOrder,
  detectColumns,
  matchSlots,
} from "./slotImport";

const CANDIDATES = [
  { regNo: "23BCE7431", name: "Asha Rao" },
  { regNo: "23BCE1111", name: "Bala Iyer" },
  { regNo: "23BEC2222", name: "Chitra M" },
  // Walk-in shape: doc key ≠ regNo (App.js landmine #2 — id wins when present)
  { id: "WALK-9", regNo: "23WLK0009", name: "Walka Singh" },
  // Two candidates sharing a name: the fuzzy fallback must refuse both
  { regNo: "23BME5555", name: "Dev Kumar" },
  { regNo: "23BME6666", name: "Dev Kumar" },
];

describe("parseCsv", () => {
  test("splits plain rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  test("handles quotes, embedded commas/newlines, and doubled-quote escapes", () => {
    const text = 'name,slot\n"Rao, Asha","9:00 AM"\n"He said ""hi""","line1\nline2"';
    expect(parseCsv(text)).toEqual([
      ["name", "slot"],
      ["Rao, Asha", "9:00 AM"],
      ['He said "hi"', "line1\nline2"],
    ]);
  });

  test("strips a leading BOM and swallows CRLF + the trailing newline", () => {
    expect(parseCsv("\uFEFFa,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("cellToString (ExcelJS value shapes)", () => {
  test("strings trim; null/undefined go blank; whole numbers stay digits", () => {
    expect(cellToString("  9:00 AM ")).toBe("9:00 AM");
    expect(cellToString(null)).toBe("");
    expect(cellToString(undefined)).toBe("");
    expect(cellToString(7431)).toBe("7431"); // numeric reg cells survive
  });

  test("Excel time-of-day serial fractions render as a clock", () => {
    expect(cellToString(0.5)).toBe("12:00 PM");
    expect(cellToString(0.3958333333333333)).toBe("9:30 AM");
  });

  test("Date cells read via UTC (ExcelJS parses date cells as UTC)", () => {
    expect(cellToString(new Date(Date.UTC(2026, 6, 20, 9, 30)))).toBe("9:30 AM");
    expect(cellToString(new Date(Date.UTC(2026, 6, 20, 14, 5)))).toBe("2:05 PM");
  });

  test("richText, hyperlink, and formula-result objects flatten to text", () => {
    expect(
      cellToString({ richText: [{ text: "9:00" }, { text: " AM" }] })
    ).toBe("9:00 AM");
    expect(
      cellToString({ text: "23BCE7431", hyperlink: "mailto:x@y.z" })
    ).toBe("23BCE7431");
    expect(cellToString({ formula: "A1", result: "10:30 AM" })).toBe("10:30 AM");
    expect(cellToString({ error: "#N/A" })).toBe("");
  });
});

describe("parseSlotOrder (best-effort, monotone within one format)", () => {
  test.each([
    ["9:00 AM", 540],
    ["12:00 AM", 0],
    ["12:30 PM", 750],
    ["2 pm", 840],
    ["10.15 am", 615],
    ["14:30", 870], // 24h clock, no meridiem
    ["9:00 AM - 9:30 AM", 540], // range → the start
    ["9.00 a.m.", 540], // dotted meridiem
    ["Slot 3", 3], // index sheets sort by the index
    ["0930", 930], // military-ish digits stay monotone
  ])("%s → %i", (input, expected) => {
    expect(parseSlotOrder(input)).toBe(expected);
  });

  test("nothing parseable → null (desk sorts those last, by name)", () => {
    expect(parseSlotOrder("")).toBeNull();
    expect(parseSlotOrder("   ")).toBeNull();
    expect(parseSlotOrder("morning batch")).toBeNull();
    expect(parseSlotOrder(null)).toBeNull();
  });
});

describe("normalizeRegNo", () => {
  test("case, spaces, dots, and the display middle-dot all collapse", () => {
    expect(normalizeRegNo("23bce 7431")).toBe("23BCE7431");
    expect(normalizeRegNo("23BCE · 7431")).toBe("23BCE7431");
    expect(normalizeRegNo(" 23bce-7431 ")).toBe("23BCE7431");
    expect(normalizeRegNo(null)).toBe("");
  });
});

describe("detectColumns (tolerant header autodetect)", () => {
  test("clean header on row 0", () => {
    expect(detectColumns([["Reg No", "Name", "Slot"]])).toEqual({
      headerIndex: 0,
      regNoCol: 0,
      slotCol: 2,
      nameCol: 1,
    });
  });

  test("messy header below a title banner and a blank row", () => {
    const rows = [
      ["MAFIA Interview Day — calling sheet"],
      [],
      ["S.No", "REGISTRATION NUMBER", "Candidate Name", "TIME SLOT"],
      ["1", "23BCE7431", "Asha Rao", "9:00 AM"],
    ];
    expect(detectColumns(rows)).toEqual({
      headerIndex: 2,
      regNoCol: 1,
      slotCol: 3,
      nameCol: 2,
    });
  });

  test("a specific Slot header beats a Timestamp column; /time/ is only a fallback", () => {
    expect(
      detectColumns([["Timestamp", "Reg no", "Name", "Slot"]])
    ).toMatchObject({ regNoCol: 1, slotCol: 3 });
    // No /slot/ header anywhere → "Time" may claim it.
    expect(detectColumns([["Reg no", "Time"]])).toMatchObject({
      regNoCol: 0,
      slotCol: 1,
    });
  });

  test("ID is a reg-column fallback only when nothing matches /reg/", () => {
    expect(detectColumns([["Student ID", "Slot"]])).toMatchObject({
      regNoCol: 0,
      slotCol: 1,
    });
  });

  test("no detectable header → null", () => {
    expect(detectColumns([["23BCE7431", "9:00 AM"]])).toBeNull();
    expect(detectColumns([])).toBeNull();
  });
});

describe("matchSlots", () => {
  test("clean sheet: every row matched, orders parsed, nothing unmatched", () => {
    const rows = [
      ["Reg No", "Name", "Slot"],
      ["23BCE7431", "Asha Rao", "9:00 AM"],
      ["23BCE1111", "Bala Iyer", "9:30 AM"],
      ["23BEC2222", "Chitra M", "10:00 AM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.ok).toBe(true);
    expect(res.unmatched).toEqual([]);
    expect(res.duplicates).toBe(0);
    expect(res.emptySlot).toBe(0);
    expect(res.unparsedOrder).toBe(0);
    expect(res.matched).toEqual([
      {
        docKey: "23BCE7431",
        regNo: "23BCE7431",
        name: "Asha Rao",
        slot: "9:00 AM",
        slotOrder: 540,
      },
      {
        docKey: "23BCE1111",
        regNo: "23BCE1111",
        name: "Bala Iyer",
        slot: "9:30 AM",
        slotOrder: 570,
      },
      {
        docKey: "23BEC2222",
        regNo: "23BEC2222",
        name: "Chitra M",
        slot: "10:00 AM",
        slotOrder: 600,
      },
    ]);
  });

  test("messy sheet: banner rows, spaced/lowercased regNos, blank decoration rows", () => {
    const rows = [
      ["Calling sheet — 20 July"],
      [],
      ["S.No", "Registration No.", "Name", "Time Slot"],
      ["1", "23bce 7431", "Asha Rao", "9:00 AM"],
      [],
      ["2", "23BCE-1111", "Bala Iyer", "9:30 AM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.ok).toBe(true);
    expect(res.matched.map((e) => e.docKey)).toEqual([
      "23BCE7431",
      "23BCE1111",
    ]);
    expect(res.unmatched).toEqual([]);
  });

  test("unmatched rows are listed with their raw cells; blank rows never count", () => {
    const rows = [
      ["Reg", "Name", "Slot"],
      ["23ZZZ0000", "Nobody Known", "11:00 AM"],
      ["23BCE7431", "Asha Rao", "9:00 AM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.matched).toHaveLength(1);
    expect(res.unmatched).toEqual([
      { regNo: "23ZZZ0000", name: "Nobody Known", slot: "11:00 AM" },
    ]);
  });

  test("duplicate regNos: LAST wins, every overwrite counted", () => {
    const rows = [
      ["Reg", "Slot"],
      ["23BCE7431", "9:00 AM"],
      ["23BCE7431", "2:00 PM"],
      ["23BCE7431", "4:00 PM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.duplicates).toBe(2);
    expect(res.matched).toEqual([
      {
        docKey: "23BCE7431",
        regNo: "23BCE7431",
        name: "Asha Rao",
        slot: "4:00 PM",
        slotOrder: 960,
      },
    ]);
  });

  test("fuzzy name fallback: unique names match, ambiguous names refuse", () => {
    const rows = [
      ["Reg", "Name", "Slot"],
      ["", "chitra m", "10:00 AM"], // no regNo, unique name → matches
      ["99XXX9999", "CHITRA M", "10:30 AM"], // wrong regNo, name rescues (dupe → last wins)
      ["", "Dev Kumar", "11:00 AM"], // ambiguous name → refused
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.matched).toEqual([
      {
        docKey: "23BEC2222",
        regNo: "23BEC2222",
        name: "Chitra M",
        slot: "10:30 AM",
        slotOrder: 630,
      },
    ]);
    expect(res.duplicates).toBe(1);
    expect(res.unmatched).toEqual([
      { regNo: "", name: "Dev Kumar", slot: "11:00 AM" },
    ]);
  });

  test("a matched person with an empty slot cell writes nothing (emptySlot)", () => {
    const rows = [
      ["Reg", "Slot"],
      ["23BCE7431", ""],
      ["23BCE1111", "9:30 AM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.emptySlot).toBe(1);
    expect(res.matched.map((e) => e.docKey)).toEqual(["23BCE1111"]);
  });

  test("unparseable slot text still imports the display string (slotOrder null, counted)", () => {
    const rows = [
      ["Reg", "Slot"],
      ["23BCE7431", "morning batch"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.matched).toEqual([
      {
        docKey: "23BCE7431",
        regNo: "23BCE7431",
        name: "Asha Rao",
        slot: "morning batch",
        slotOrder: null,
      },
    ]);
    expect(res.unparsedOrder).toBe(1);
  });

  test("walk-in docs: docKey honors id over regNo (landmine #2)", () => {
    const rows = [
      ["Reg", "Slot"],
      ["23WLK0009", "12:00 PM"],
    ];
    const res = matchSlots(rows, CANDIDATES);
    expect(res.matched[0].docKey).toBe("WALK-9");
    expect(res.matched[0].regNo).toBe("23WLK0009");
  });

  test("no detectable columns → ok:false with a human error, nothing matched", () => {
    const res = matchSlots([["just", "data"], ["1", "2"]], CANDIDATES);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/reg-number header/i);
    expect(res.matched).toEqual([]);
  });

  test("CSV end-to-end: parseCsv output feeds matchSlots (the .csv path)", () => {
    const text =
      '\uFEFFReg No,Name,Slot\r\n"23BCE7431","Rao, Asha","9:00 AM"\r\n23ZZZ0000,Unknown,10:00 AM\r\n';
    const res = matchSlots(parseCsv(text), CANDIDATES);
    expect(res.ok).toBe(true);
    expect(res.matched.map((e) => e.docKey)).toEqual(["23BCE7431"]);
    expect(res.unmatched).toHaveLength(1);
  });
});
