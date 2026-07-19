/**
 * Desk screen — presentational checks for the check-in desk role (owner
 * feature 2026-07-20). App.js owns the role resolution and both writes
 * (check-in / mark-not-arrived); this screen renders the live calling
 * sheet: rows, counts, the ONE action, the not-arrived confirm, and the
 * read-only record drawer. Pure fixtures — no firebase, no App.js.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Desk, { filterDeskRows, compareDeskRows } from "./Desk";

const CANDIDATES = [
  {
    id: "A1",
    regNo: "23BCE7431",
    name: "Asha Rao",
    year: "1st Year",
    whatsappNumber: "9876543210",
    activated: true,
    activatedAt: "2026-07-20T09:41:00",
    verdict: { talentComm: [], workComm: [] },
    preferences: { talentComm: { pref1: "Music" }, workComm: { pref1: "Design" } },
    comments: "Front row",
    college: "VIT",
    branch: "CSE",
  },
  {
    id: "B2",
    regNo: "23BCE1111",
    name: "Bala Iyer",
    year: "2nd Year",
    whatsappNumber: "9876500000",
  },
  {
    id: "C3",
    regNo: "23BEC2222",
    name: "Chitra M",
    year: "1st Year",
    activated: true,
    verdict: { talentComm: ["Music"], workComm: [] },
  },
];

const renderDesk = (overrides = {}) => {
  const props = {
    candidates: CANDIDATES,
    loaded: true,
    onCheckIn: jest.fn(),
    onMarkNotArrived: jest.fn().mockResolvedValue(true),
    busyKey: null,
    ...overrides,
  };
  render(<Desk {...props} />);
  return props;
};

describe("Desk list + counts", () => {
  test("renders every candidate with the live counts (checked-in honest, waiting = §5 view)", () => {
    renderDesk();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Bala Iyer")).toBeInTheDocument();
    expect(screen.getByText("Chitra M")).toBeInTheDocument();

    // Checked in 2 / 3 (Asha + Chitra explicit; Bala's missing field never
    // counts — landmine #11 stays honest) · Waiting 1 (Asha only: Chitra
    // already has a verdict).
    const counts = screen.getByRole("status");
    expect(within(counts).getByText("2 / 3")).toBeInTheDocument();
    expect(within(counts).getByText("Waiting")).toBeInTheDocument();
    expect(within(counts).getByText("1")).toBeInTheDocument();
  });

  test("the WhatsApp number is a tap-to-call tel: link", () => {
    renderDesk();
    const call = screen.getByRole("link", { name: /call bala iyer/i });
    expect(call).toHaveAttribute("href", "tel:9876500000");
    expect(within(call).getByText("9876500000")).toBeInTheDocument();
  });

  test("search narrows by name substring or regNo prefix", () => {
    renderDesk();
    const field = screen.getByRole("searchbox");
    fireEvent.change(field, { target: { value: "bala" } });
    expect(screen.getByText("Bala Iyer")).toBeInTheDocument();
    expect(screen.queryByText("Asha Rao")).not.toBeInTheDocument();

    fireEvent.change(field, { target: { value: "23BEC" } });
    expect(screen.getByText("Chitra M")).toBeInTheDocument();
    expect(screen.queryByText("Bala Iyer")).not.toBeInTheDocument();
  });

  test("windows the list at 30 rows with Show more", () => {
    const many = Array.from({ length: 35 }, (_, i) => ({
      id: `R${i}`,
      regNo: `23REG${1000 + i}`,
      name: `Cand ${String(i).padStart(2, "0")}`,
    }));
    renderDesk({ candidates: many });
    expect(screen.getAllByText(/^Cand /)).toHaveLength(30);
    const more = screen.getByRole("button", { name: /show more \(5\)/i });
    fireEvent.click(more);
    expect(screen.getAllByText(/^Cand /)).toHaveLength(35);
  });
});

describe("Desk check-in action (the ONE action)", () => {
  test("un-arrived rows offer Check in → onCheckIn(candidate)", () => {
    const props = renderDesk();
    // Only Bala (no activated field) shows the action button.
    const btn = screen.getByRole("button", { name: "Check in" });
    fireEvent.click(btn);
    expect(props.onCheckIn).toHaveBeenCalledTimes(1);
    expect(props.onCheckIn.mock.calls[0][0].regNo).toBe("23BCE1111");
  });

  test("checked-in rows wear the quiet state; tapping asks before marking not arrived", async () => {
    const props = renderDesk();
    // Asha carries the arrival time; Chitra (no activatedAt) reads plain.
    const checkedStates = screen.getAllByRole("button", {
      name: /✓ checked in/i,
    });
    expect(checkedStates).toHaveLength(2);

    const asha = checkedStates.find((b) => /9:41/.test(b.textContent));
    expect(asha).toBeTruthy();
    fireEvent.click(asha);

    // ConfirmPopover restates the person before the revert.
    expect(
      await screen.findByText(/mark asha rao as not arrived\?/i)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /mark not arrived/i })
    );
    expect(props.onMarkNotArrived).toHaveBeenCalledTimes(1);
    expect(props.onMarkNotArrived.mock.calls[0][0].regNo).toBe("23BCE7431");

    // Resolved true → the popover closes (App.js's write landed).
    await waitFor(() =>
      expect(
        screen.queryByText(/mark asha rao as not arrived\?/i)
      ).not.toBeInTheDocument()
    );
  });
});

describe("Desk read-only record drawer", () => {
  test("row tap opens the full record — identity, prefs, comments; NO payment, NO verdict controls", () => {
    renderDesk();
    fireEvent.click(screen.getByRole("button", { name: /asha rao/i }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Details")).toBeInTheDocument();
    expect(within(drawer).getByText("VIT")).toBeInTheDocument();
    expect(within(drawer).getByText("Preferences")).toBeInTheDocument();
    expect(within(drawer).getByText("Music")).toBeInTheDocument();
    expect(within(drawer).getByText("Front row")).toBeInTheDocument();
    // The phone stays tap-to-call inside the record too.
    expect(
      within(drawer).getByRole("link", { name: "9876543210" })
    ).toHaveAttribute("href", "tel:9876543210");

    // Watertight: no payment surface, no verdict controls, no verify.
    expect(within(drawer).queryByText(/payment/i)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/verify/i)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/verdict/i)).not.toBeInTheDocument();
  });
});

describe("Desk pure helpers", () => {
  test("filterDeskRows: empty query returns all; name substring OR regNo prefix otherwise", () => {
    expect(filterDeskRows(CANDIDATES, "")).toHaveLength(3);
    expect(filterDeskRows(CANDIDATES, "  ")).toHaveLength(3);
    expect(filterDeskRows(CANDIDATES, "iyer")).toHaveLength(1);
    expect(filterDeskRows(CANDIDATES, "23bce")).toHaveLength(2); // prefix, case-insensitive
    expect(filterDeskRows(CANDIDATES, "zzz")).toHaveLength(0);
  });

  test("compareDeskRows: slotOrder ascending, unslotted last, name fallback (no slots → plain name order)", () => {
    const a = { name: "Zed", slotOrder: 1 };
    const b = { name: "Ann", slotOrder: 2 };
    const c = { name: "Moe" }; // unslotted → last
    const d = { name: "Abe" }; // unslotted → name order among themselves
    expect([c, b, d, a].sort(compareDeskRows).map((x) => x.name)).toEqual([
      "Zed",
      "Ann",
      "Abe",
      "Moe",
    ]);
  });
});
