/**
 * The celebration pass (owner 2026-07-20) — outcome-mapped intensity, the
 * hard rule, verified at the screen level:
 *
 *   green room (payment confirmed — only ever a SELECTED candidate)
 *     → FULL: drawn tick + ring + 32-bit spectrum confetti burst;
 *   Done · selected → MILD echo: drawn tick, stamp slam, five flecks —
 *     NEVER confetti;
 *   Done · not selected → ZERO festivity: neutral complete mark, quiet
 *     stamp, no flecks, no burst;
 *   reduced motion → transient bits (confetti/flecks) never render.
 *
 * The celebration frames the facts, never obscures them: the role=status
 * lines stay intact; all decoration is aria-hidden.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Payment from "./Payment";
import Done from "./Done";

afterEach(() => {
  delete window.matchMedia;
});

const greenRoom = { name: "Priya S", regNo: "23BCE7431", txn: "TXN12345" };

const selectedRecap = {
  name: "Priya S",
  verdict: { talentComm: ["Dance"], workComm: [] },
  verdictStatus: "selected",
  paid: true,
  manuallyVerified: false,
};

const notSelectedRecap = {
  name: "Rahul V",
  verdict: { talentComm: [], workComm: [] },
  verdictStatus: "not_selected",
  paid: false,
  manuallyVerified: false,
};

describe("green room — the full beat", () => {
  test("drawn tick + ring + 32 spectrum confetti bits, facts intact", () => {
    const { container } = render(<Payment greenRoom={greenRoom} />);

    // The drawn check, full tempo, with the ONE ring pulse.
    const check = container.querySelector(".pay-greenroom .celebrate-check");
    expect(check).toBeTruthy();
    expect(check.className).toContain("celebrate-check--drawn");
    expect(check.className).toContain("celebrate-check--full");
    expect(
      container.querySelector(".pay-greenroom .celebrate-check__ring")
    ).toBeTruthy();

    // The burst: 32 bits, all six canonical spectrum tokens, decoration.
    const bits = container.querySelectorAll(".celebrate-burst__bit");
    expect(bits.length).toBe(32);
    ["red", "orange", "amber", "green", "blue", "violet"].forEach((c) =>
      expect(
        container.querySelectorAll(".celebrate-burst__bit--" + c).length
      ).toBeGreaterThan(0)
    );
    expect(
      container.querySelector(".pay-greenroom__stage")
    ).toHaveAttribute("aria-hidden", "true");

    // Legible-from-two-meters: the role=status facts are untouched.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("PAID ₹300");
    expect(status).toHaveTextContent("Priya S");
    expect(status).toHaveTextContent("TXN12345");
  });

  test("reduced motion: the confetti never renders, the tick stays", () => {
    window.matchMedia = () => ({ matches: true });
    const { container } = render(<Payment greenRoom={greenRoom} />);
    expect(container.querySelector(".celebrate-burst")).toBeFalsy();
    expect(container.querySelector(".celebrate-check")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("PAID ₹300");
  });
});

describe("Done — outcome-mapped intensity", () => {
  test("selected: mild echo — drawn tick, slam, five flecks, never confetti", () => {
    const { container } = render(
      <Done recap={selectedRecap} onNext={() => {}} />
    );
    expect(container.querySelector(".iv-done--celebrate")).toBeTruthy();

    const check = container.querySelector(".celebrate-check");
    expect(check.className).toContain("celebrate-check--drawn");
    expect(check.className).toContain("celebrate-check--brisk");
    expect(check.className).toContain("celebrate-check--success");
    // Done stays calmer than the green room: no ring here.
    expect(container.querySelector(".celebrate-check__ring")).toBeFalsy();

    expect(container.querySelector(".ui-stamp--slam")).toBeTruthy();
    expect(container.querySelectorAll(".iv-done__fleck").length).toBe(5);

    // The hard rule: confetti belongs to the green room ALONE.
    expect(container.querySelector(".celebrate-burst")).toBeFalsy();

    expect(screen.getByText("SELECTED · Dance")).toBeInTheDocument();
  });

  test("not selected: zero festivity — neutral mark, quiet stamp, nothing moves", () => {
    const { container } = render(
      <Done recap={notSelectedRecap} onNext={() => {}} />
    );
    expect(container.querySelector(".iv-done--quiet")).toBeTruthy();
    expect(container.querySelector(".iv-done--celebrate")).toBeFalsy();

    // The ✓ becomes a neutral "recorded" mark: complete, ink, static.
    const check = container.querySelector(".celebrate-check");
    expect(check.className).toContain("celebrate-check--neutral");
    expect(check.className).not.toContain("celebrate-check--drawn");

    expect(container.querySelector(".ui-stamp--quiet")).toBeTruthy();
    expect(container.querySelector(".ui-stamp--slam")).toBeFalsy();
    expect(container.querySelectorAll(".iv-done__fleck").length).toBe(0);
    expect(container.querySelector(".celebrate-burst")).toBeFalsy();

    expect(screen.getByText("NOT SELECTED")).toBeInTheDocument();
  });

  test("selected + reduced motion: flecks never render, mark still success", () => {
    window.matchMedia = () => ({ matches: true });
    const { container } = render(
      <Done recap={selectedRecap} onNext={() => {}} />
    );
    expect(container.querySelectorAll(".iv-done__fleck").length).toBe(0);
    expect(
      container.querySelector(".celebrate-check--success")
    ).toBeTruthy();
  });

  test("pre-Phase-7 recap (no verdictStatus) falls back to the array check", () => {
    const legacy = {
      name: "Asha K",
      verdict: { talentComm: [], workComm: ["Human Resources"] },
      paid: false,
    };
    const { container } = render(<Done recap={legacy} onNext={() => {}} />);
    expect(container.querySelector(".iv-done--celebrate")).toBeTruthy();
    expect(screen.getByText("SELECTED · HR")).toBeInTheDocument();
  });

  test("Undo verdict ghost stays wired beneath the primary", () => {
    const onUndo = jest.fn();
    render(
      <Done
        recap={selectedRecap}
        onNext={() => {}}
        canUndoVerdict
        onUndoVerdict={onUndo}
      />
    );
    const undo = screen.getByRole("button", { name: "Undo verdict" });
    undo.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Next candidate" })
    ).toBeInTheDocument();
  });
});
