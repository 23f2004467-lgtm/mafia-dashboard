// Pure export-row mapping for the admin ExcelJS export (Phase 0 safety fixture).
// Guards landmines #9/#10: the export column order, header strings, and per-cell
// derivations must never change through the admin rebuild.
//
// Mirrors exactly what AdminPortal.jsx fed ExcelJS before extraction:
//   worksheet.addRow(Object.keys(formattedData[0] || {}));
//   formattedData.forEach(row => worksheet.addRow(Object.values(row)));
// i.e. returns [headerRow, ...dataRows] as arrays of cell values.
// With an empty candidate list the header row is [] (empty addRow), as before.
// No firebase or exceljs imports — this module must stay pure.

export function buildExportRows(candidates) {
  const formattedData = candidates.map((cand) => ({
    Name: cand.name || "",
    RegNo: cand.regNo || "",
    Year: cand.year || "",
    College: cand.college || "",
    Branch: cand.branch || "",
    WhatsApp: cand.whatsappNumber || "",
    Paid: cand.paid ? "Yes" : "No",
    ManuallyVerified: cand.manuallyVerified ? "Yes" : "No",
    PaymentAmount: cand.paymentDetails?.amount || "",
    PaymentMethod: cand.paymentDetails?.method || "",
    TalentCommPrefs: `${cand.preferences?.talentComm?.pref1 || ""}${cand.preferences?.talentComm?.pref2 ? `, ${cand.preferences.talentComm.pref2}` : ""}`,
    WorkCommPrefs: `${cand.preferences?.workComm?.pref1 || ""}${cand.preferences?.workComm?.pref2 ? `, ${cand.preferences.workComm.pref2}` : ""}${cand.preferences?.workComm?.pref3 ? `, ${cand.preferences.workComm.pref3}` : ""}`,
    TalentCommVerdict: Array.isArray(cand.verdict?.talentComm) ? cand.verdict.talentComm.join(", ") : "",
    WorkCommVerdict: Array.isArray(cand.verdict?.workComm) ? cand.verdict.workComm.join(", ") : "",
    Comments: cand.comments || "",
    LastUpdatedBy: cand.lastUpdatedBy || "",
    // Phase 7 additive columns (landmine #9): appended AFTER the 16 legacy
    // columns so legacy order stays byte-identical. Both mirror the raw
    // additive field and stay EMPTY on old docs that lack it — never derived,
    // never inferred (a blank cell is the honest "not recorded", not a state).
    VerdictStatus: cand.verdictStatus || "",
    CheckedIn:
      cand.activated === true ? "Yes" : cand.activated === false ? "No" : "",
  }));

  return [
    Object.keys(formattedData[0] || {}),
    ...formattedData.map((row) => Object.values(row)),
  ];
}
