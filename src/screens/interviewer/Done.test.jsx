/**
 * Done screen — presentational checks for the persistent "Undo verdict"
 * affordance (owner decision 2026-07-20: a quiet ghost button on Done
 * replaces the 10 s undo toast). App.js owns the capability and its
 * payment-activity + stale-check guards; the screen only renders the
 * button while `canUndoVerdict` and fires `onUndoVerdict` on tap.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Done from "./Done";

const recap = {
  name: "Priya",
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
