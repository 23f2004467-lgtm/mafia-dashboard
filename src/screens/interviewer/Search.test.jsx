/**
 * Search screen — presentational checks for the waiting room + the two
 * "My recent" placements (owner feature 2026-07-20). App.js owns the live
 * candidates listener, the §5 isWaiting derivation and the longest-waiting
 * sort (candidateState.test.js covers those); this file checks what the
 * screen RENDERS: the empty-query-only waiting section with the journey
 * pill riding the pill slot, the 8-row window + "Show all {N}", hidden at
 * 0, the quiet Clear on BOTH recents placements, and the persisted
 * >= 900px sidebar collapse. Pure fixtures — no firebase, no App.js.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Search from "./Search";

const waitingCand = (i) => ({
  id: `W${i}`,
  regNo: `23BCE${7000 + i}`,
  name: `Waiting ${String(i).padStart(2, "0")}`,
  year: "1st Year",
  activated: true,
  activatedAt: `2026-07-20T09:${String(10 + i).padStart(2, "0")}:00`,
});

const RECENT = {
  id: "R1",
  regNo: "23BCE1234",
  name: "Recent Rao",
  paid: true,
};

const renderSearch = (overrides = {}) => {
  const props = {
    query: "",
    onQueryChange: jest.fn(),
    results: [],
    recents: [],
    waiting: [],
    onSelect: jest.fn(),
    onSelectRecent: jest.fn(),
    onAddWalkIn: jest.fn(),
    onClearRecents: jest.fn(),
    ...overrides,
  };
  render(<Search {...props} />);
  return props;
};

beforeEach(() => {
  localStorage.clear();
});

describe("Waiting room (empty query only)", () => {
  test("lists the desk's queue with the journey pill riding the pill slot", () => {
    const props = renderSearch({
      waiting: [waitingCand(1), waitingCand(2)],
    });

    const section = screen.getByRole("region", { name: "Waiting room" });
    // Results-head language: caps micro-label + the list-size count (the
    // same number as "Show all {N}" — never a progress counter, §2 #34).
    expect(
      within(section).getByRole("heading", { name: "Waiting room" })
    ).toBeInTheDocument();
    expect(within(section).getByText("2")).toBeInTheDocument();

    // Standard ResultRows; journey pill beside the two-state interviewer
    // payment pill (track="paymentIv" — Unpaid/Paid only) in the pill slot.
    expect(within(section).getByText("Waiting 01")).toBeInTheDocument();
    expect(within(section).getByText("Waiting 02")).toBeInTheDocument();
    expect(
      section.querySelectorAll(".ui-pill--track-journey")
    ).toHaveLength(2);
    expect(
      section.querySelectorAll(".ui-pill--track-paymentIv")
    ).toHaveLength(2);
    // Never the admin three-state track on an interviewer surface.
    expect(
      section.querySelectorAll(".ui-pill--track-payment")
    ).toHaveLength(0);

    // Row tap opens the candidate through the standard onSelect path.
    fireEvent.click(within(section).getByText("Waiting 01"));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect.mock.calls[0][0].regNo).toBe("23BCE7001");
  });

  test("hidden entirely at 0 and while a query is active", () => {
    renderSearch({ waiting: [] });
    expect(
      screen.queryByRole("region", { name: "Waiting room" })
    ).not.toBeInTheDocument();
  });

  test("a live query replaces it with results — the queue never competes", () => {
    renderSearch({ waiting: [waitingCand(1)], query: "asha" });
    expect(
      screen.queryByRole("region", { name: "Waiting room" })
    ).not.toBeInTheDocument();
  });

  test("windows at 8 with Show all {N}", () => {
    const ten = Array.from({ length: 10 }, (_, i) => waitingCand(i));
    renderSearch({ waiting: ten });

    expect(screen.getAllByText(/^Waiting \d\d$/)).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show all 10" }));
    expect(screen.getAllByText(/^Waiting \d\d$/)).toHaveLength(10);
  });
});

describe("My recent — both placements (inline + >= 900px sidebar)", () => {
  test("the quiet Clear fires from the inline section AND the sidebar", () => {
    const props = renderSearch({ recents: [RECENT] });

    const clears = screen.getAllByRole("button", { name: "Clear" });
    expect(clears).toHaveLength(2); // inline (phones) + sidebar (>= 900px)
    clears.forEach((btn) => fireEvent.click(btn));
    expect(props.onClearRecents).toHaveBeenCalledTimes(2);
  });

  test("recent rows route through onSelectRecent (stub re-resolution path)", () => {
    const props = renderSearch({ recents: [RECENT] });

    // The same paper-card row renders in both placements.
    const rows = screen.getAllByRole("button", { name: /recent rao/i });
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[0]);
    expect(props.onSelectRecent).toHaveBeenCalledWith(RECENT);
  });

  test("sidebar collapse persists under mafia.recentsSidebar and restores", () => {
    renderSearch({ recents: [RECENT] });

    fireEvent.click(screen.getByRole("button", { name: "Hide my recent" }));
    expect(localStorage.getItem("mafia.recentsSidebar")).toBe("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Show my recent" }));
    expect(localStorage.getItem("mafia.recentsSidebar")).toBe("open");
  });

  // A11y (2026-07-20): the collapse/reopen control announces its state via
  // aria-expanded (only one is exposed at a time in the browser via the CSS
  // visibility swap — in jsdom both are present, so both are asserted).
  test("the sidebar toggle carries aria-expanded reflecting the state", () => {
    renderSearch({ recents: [RECENT] });

    // Closed by default (owner call 2026-07-20: on-demand panel) → collapsed.
    expect(
      screen.getByRole("button", { name: "Hide my recent" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Show my recent" })
    ).toHaveAttribute("aria-expanded", "false");

    // Open → the toggle now announces expanded.
    fireEvent.click(screen.getByRole("button", { name: "Show my recent" }));
    expect(
      screen.getByRole("button", { name: "Hide my recent" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Show my recent" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("a persisted collapse renders the sidebar collapsed from first paint", () => {
    localStorage.setItem("mafia.recentsSidebar", "collapsed");
    renderSearch({ recents: [RECENT] });

    expect(
      screen.getByRole("complementary", { name: "My recent" })
    ).toHaveClass("iv-search__side--collapsed");
  });
});
