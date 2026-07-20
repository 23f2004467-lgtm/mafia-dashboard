/**
 * Login — the check-in desk secondary path (owner feature 2026-07-20).
 * Presentational only: App.js owns the anonymous sign-in; this file checks
 * what the screen RENDERS — the quiet "I'm at the check-in desk" link, the
 * name+code form it swaps in, the disabled-until-filled Enter, the submit
 * payload, the inline desk-error Banner, and the return path. The Google CTA
 * stays primary throughout. Pure fixtures — no firebase, no App.js.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Login from "./Login";

const enterDeskMode = () =>
  fireEvent.click(screen.getByRole("button", { name: /at the check-in desk/i }));

describe("Login — Google is primary, desk is the quiet secondary path", () => {
  test("default view shows the Google CTA and the desk link", () => {
    render(<Login onLogin={jest.fn()} onDeskLogin={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /at the check-in desk/i })
    ).toBeInTheDocument();
    // The desk form is not mounted until the operator opts in.
    expect(screen.queryByLabelText("Desk code")).not.toBeInTheDocument();
  });

  test("the desk link swaps in the name + code form (Google CTA gone)", () => {
    render(<Login onLogin={jest.fn()} onDeskLogin={jest.fn()} />);
    enterDeskMode();

    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Desk code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with google/i })
    ).not.toBeInTheDocument();
  });

  test("Enter is disabled until BOTH name and code are filled", () => {
    render(<Login onLogin={jest.fn()} onDeskLogin={jest.fn()} />);
    enterDeskMode();

    const enter = screen.getByRole("button", { name: "Enter" });
    expect(enter).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Asha" },
    });
    expect(enter).toBeDisabled(); // code still empty

    fireEvent.change(screen.getByLabelText("Desk code"), {
      target: { value: "K7F2QJ" },
    });
    expect(enter).not.toBeDisabled();
  });

  test("submitting hands {name, code} to onDeskLogin", () => {
    const onDeskLogin = jest.fn();
    render(<Login onLogin={jest.fn()} onDeskLogin={onDeskLogin} />);
    enterDeskMode();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Asha Rao" },
    });
    fireEvent.change(screen.getByLabelText("Desk code"), {
      target: { value: "k7f2qj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));

    expect(onDeskLogin).toHaveBeenCalledTimes(1);
    expect(onDeskLogin).toHaveBeenCalledWith({
      name: "Asha Rao",
      code: "k7f2qj",
    });
  });

  test("a desk error arriving in the desk view renders an inline Banner", () => {
    // Google error lives in the Google view.
    const { rerender } = render(
      <Login onLogin={jest.fn()} onDeskLogin={jest.fn()} error="Google failed" />
    );
    expect(screen.getByText("Google failed")).toBeInTheDocument();

    // Enter the desk view; App then reports a wrong-code error (the prop
    // arrives while the operator is here — the real submit → error flow).
    enterDeskMode();
    expect(screen.queryByText(/didn.t match/i)).not.toBeInTheDocument();
    rerender(
      <Login
        onLogin={jest.fn()}
        onDeskLogin={jest.fn()}
        deskError="That code didn't match. Check with the coordinator."
      />
    );
    expect(screen.getByText(/didn.t match/i)).toBeInTheDocument();

    // Editing a field hides the stale banner (no correction under a red banner).
    fireEvent.change(screen.getByLabelText("Desk code"), {
      target: { value: "X" },
    });
    expect(screen.queryByText(/didn.t match/i)).not.toBeInTheDocument();

    // A FRESH error from App (it resets to "" then re-sets) re-arms the banner.
    rerender(<Login onLogin={jest.fn()} onDeskLogin={jest.fn()} deskError="" />);
    rerender(
      <Login
        onLogin={jest.fn()}
        onDeskLogin={jest.fn()}
        deskError="Check-in desk sign-in is not enabled yet. Ask the coordinator."
      />
    );
    expect(screen.getByText(/not enabled yet/i)).toBeInTheDocument();
  });

  test("Back to sign-in returns to the Google CTA", () => {
    render(<Login onLogin={jest.fn()} onDeskLogin={jest.fn()} />);
    enterDeskMode();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign-in" }));

    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Desk code")).not.toBeInTheDocument();
  });

  test("booting splash shows neither the Google CTA nor the desk link", () => {
    const { container } = render(<Login booting />);
    expect(
      screen.queryByRole("button", { name: /continue with google/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /at the check-in desk/i })
    ).not.toBeInTheDocument();
    // Still the branded stage.
    expect(within(container).getByText("MAFIA")).toBeInTheDocument();
  });
});
