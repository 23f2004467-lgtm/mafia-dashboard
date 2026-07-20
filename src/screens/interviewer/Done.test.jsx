/**
 * Done screen — presentational checks for the verdict correctives and the
 * amber truth banner (owner decision 2026-07-20):
 *  - a persistent ghost "Undo verdict" replaces the 10 s undo toast (App
 *    owns the capability + its payment-activity/stale-check guards; the
 *    screen renders it while `canUndoVerdict` and fires `onUndoVerdict`);
 *  - an ALWAYS-present ghost "Edit verdict" fires `onEditVerdict`;
 *  - a tone="warning" banner "Verdict saved · payment not received" shows
 *    ONLY for a SELECTED + UNPAID recap (state-based, not path-based).
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Done from "./Done";

const recap = {
  name: "Priya",
  regNo: "23BCE7431",
  verdict: { talentComm: ["Dance"], workComm: [] },
  verdictStatus: "selected",
  paid: false,
  manuallyVerified: false,
};

describe("Done undo affordance (owner decision 2026-07-20)", () => {
  test("ghost Undo verdict renders only while the capability is offered", () => {
    const { rerender } = render(
      <Done recap={recap} onNext={() => {}} canUndoVerdict onUndoVerdict={() => {}} />
    );
    expect(
      screen.getByRole("button", { name: /undo verdict/i })
    ).toBeInTheDocument();

    // Capability cleared (route away / payment activity / consumed): gone.
    rerender(
      <Done
        recap={recap}
        onNext={() => {}}
        canUndoVerdict={false}
        onUndoVerdict={() => {}}
      />
    );
    expect(
      screen.queryByRole("button", { name: /undo verdict/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next candidate/i })
    ).toBeInTheDocument();
  });

  test("tapping Undo verdict fires onUndoVerdict, never onNext", () => {
    const onNext = jest.fn();
    const onUndoVerdict = jest.fn();
    render(
      <Done recap={recap} onNext={onNext} canUndoVerdict onUndoVerdict={onUndoVerdict} />
    );
    fireEvent.click(screen.getByRole("button", { name: /undo verdict/i }));
    expect(onUndoVerdict).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe("Done Edit verdict corrective (owner decision 2026-07-20)", () => {
  test("Edit verdict is ALWAYS present — with or without the undo capability", () => {
    const { rerender } = render(
      <Done recap={recap} onNext={() => {}} onEditVerdict={() => {}} />
    );
    // No undo capability: Edit still there, Undo is not.
    expect(
      screen.getByRole("button", { name: /edit verdict/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /undo verdict/i })
    ).not.toBeInTheDocument();

    // Capability alive: both correctives show together.
    rerender(
      <Done
        recap={recap}
        onNext={() => {}}
        canUndoVerdict
        onUndoVerdict={() => {}}
        onEditVerdict={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /undo verdict/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit verdict/i })
    ).toBeInTheDocument();
  });

  test("Edit verdict applies on a not_selected recap (a mis-reject is editable)", () => {
    const onEditVerdict = jest.fn();
    render(
      <Done
        recap={{
          name: "Rahul",
          regNo: "23BCE9999",
          verdict: { talentComm: [], workComm: [] },
          verdictStatus: "not_selected",
          paid: false,
        }}
        onNext={() => {}}
        onEditVerdict={onEditVerdict}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit verdict/i }));
    expect(onEditVerdict).toHaveBeenCalledTimes(1);
  });
});

describe("Done amber truth banner (owner decision 2026-07-20)", () => {
  const WARNING = /verdict saved · payment not received/i;

  test("shows for a SELECTED + UNPAID recap (state-based)", () => {
    render(<Done recap={recap} onNext={() => {}} onEditVerdict={() => {}} />);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  test("hidden once the candidate is paid (even if unverified)", () => {
    render(
      <Done
        recap={{ ...recap, paid: true, manuallyVerified: false }}
        onNext={() => {}}
        onEditVerdict={() => {}}
      />
    );
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  test("never shows for a not_selected recap, paid or not", () => {
    render(
      <Done
        recap={{
          name: "Rahul",
          regNo: "23BCE9999",
          verdict: { talentComm: [], workComm: [] },
          verdictStatus: "not_selected",
          paid: false,
        }}
        onNext={() => {}}
        onEditVerdict={() => {}}
      />
    );
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
