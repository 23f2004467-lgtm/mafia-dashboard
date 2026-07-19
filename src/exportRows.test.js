// Phase 0 export safety fixture (landmines #9/#10).
// The admin ExcelJS export mapping must never change through the redesign:
// same 16 columns, same order, same header strings, same per-cell derivations,
// same empty-cell behavior. "Export unchanged" in later phases means this test
// stays green against the committed fixtures (xlsx container metadata is out
// of scope).

import { buildExportRows } from "./exportRows";
import sampleCandidates from "./__fixtures__/export-sample.json";
import expectedRows from "./__fixtures__/export-rows.json";

describe("buildExportRows", () => {
  it("maps the sample candidates to the exact committed header + data rows", () => {
    expect(buildExportRows(sampleCandidates)).toEqual(expectedRows);
  });

  it("keeps the 16 legacy columns fixed, then appends the 2 Phase-7 columns", () => {
    const [header] = buildExportRows(sampleCandidates);
    expect(header).toEqual([
      // 16 legacy columns — order byte-identical to pre-Phase-7 (landmines #9/#10)
      "Name",
      "RegNo",
      "Year",
      "College",
      "Branch",
      "WhatsApp",
      "Paid",
      "ManuallyVerified",
      "PaymentAmount",
      "PaymentMethod",
      "TalentCommPrefs",
      "WorkCommPrefs",
      "TalentCommVerdict",
      "WorkCommVerdict",
      "Comments",
      "LastUpdatedBy",
      // 2 additive Phase-7 columns, appended at the end
      "VerdictStatus",
      "CheckedIn",
    ]);
  });

  it("returns a single empty header row for an empty candidate list (pre-extraction behavior)", () => {
    expect(buildExportRows([])).toEqual([[]]);
  });

  it("renders the two additive columns per raw field, blank on old docs, never invented", () => {
    // VerdictStatus / CheckedIn are the last two cells. The fixture covers every
    // combination of the two optional additive fields; a missing field is ALWAYS
    // an empty cell (landmine #9/#11) — never derived, never inferred as a state.
    const [, ...dataRows] = buildExportRows(sampleCandidates);
    const tails = dataRows.map((row) => row.slice(-2));
    expect(tails).toEqual([
      ["selected", "Yes"], // Asha:    verdictStatus + activated:true
      ["not_selected", "No"], // Bharat:  verdictStatus + activated:false
      ["", ""], // Chitra:  old doc — NEITHER field → both blank
      ["selected", ""], // Walk-in: verdictStatus present, activated missing → blank CheckedIn
      ["", "Yes"], // Esha:    activated:true, no verdict yet → blank VerdictStatus
    ]);
  });
});
