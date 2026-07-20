/**
 * Payment screen — presentational checks for cash mode (Stage C, owner truth
 * #4, 2026-07-20). App.js owns the ACCOUNT list (PAYMENT_ACCOUNTS = the two UPI
 * rails + the Cash sentinel), the mark-paid write (buildPaymentClaim) and the
 * QR session; this file checks what the SCREEN renders off the selected rail:
 *  - the ACCOUNT zone offers Cash as a third radio, below the two UPI cards;
 *  - selecting a UPI rail shows the QR zone and the plain hold label;
 *  - selecting Cash HIDES the QR zone (no QR for cash) and relabels the hold
 *    to "… cash received".
 * Pure fixtures — no firebase, no App.js.
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Payment from "./Payment";

const UPI_A = { id: "a@okhdfcbank", name: "Bhuta's UPI", type: "HDFC Bank" };
const UPI_B = { id: "b@okaxis", name: "Club UPI", type: "Axis Bank" };
const CASH = { id: "cash", name: "Cash", type: "Collected in person", cash: true };
const ACCOUNTS = [UPI_A, UPI_B, CASH];

const renderPayment = (overrides = {}) => {
  const props = {
    subject: { name: "Ravi Kumar", regNo: "23BCE7001" },
    amount: "300",
    upiAccounts: ACCOUNTS,
    selectedUpi: 0,
    onSelectUpi: jest.fn(),
    qrVisible: false,
    onShowQR: jest.fn(),
    onRegenerate: jest.fn(),
    onMarkPaid: jest.fn(),
    onCancelPayment: jest.fn(),
    onUndoVerdict: jest.fn(),
    onEditVerdict: jest.fn(),
    onContinue: jest.fn(),
    ...overrides,
  };
  render(<Payment {...props} />);
  return props;
};

describe("Payment ACCOUNT zone — Cash is a first-class rail (owner truth #4)", () => {
  test("offers Cash as a third radio, below the two UPI cards, and selecting it routes through onSelectUpi(2)", () => {
    const props = renderPayment({ selectedUpi: 0 });

    const group = screen.getByRole("radiogroup", { name: "Payment account" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);

    // Cash is the last card, labelled + with its in-person helper line.
    expect(within(group).getByText("Cash")).toBeInTheDocument();
    expect(within(group).getByText("Collected in person")).toBeInTheDocument();

    fireEvent.click(radios[2]);
    expect(props.onSelectUpi).toHaveBeenCalledWith(2);
  });
});

describe("Payment QR zone + hold label follow the selected rail", () => {
  test("a UPI rail shows the QR zone and the plain 'received' hold label", () => {
    renderPayment({ selectedUpi: 0 });

    expect(
      screen.getByRole("heading", { name: "Payment QR" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show QR" })).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /hold to confirm.*₹300 received/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cash received/i })
    ).not.toBeInTheDocument();
  });

  test("Cash hides the QR zone entirely and relabels the hold to '… cash received'", () => {
    renderPayment({ selectedUpi: 2 });

    // No QR for cash: the whole zone (heading + Show QR) is gone.
    expect(
      screen.queryByRole("heading", { name: "Payment QR" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show QR" })
    ).not.toBeInTheDocument();

    // The hold-to-confirm is the only path, and it names the cash rail.
    expect(
      screen.getByRole("button", { name: /hold to confirm.*cash received/i })
    ).toBeInTheDocument();
  });

  test("a live QR (qrVisible) still hides when Cash is the selected rail", () => {
    // Switching to Cash while a UPI session is live must not leave the QR up.
    renderPayment({ selectedUpi: 2, qrVisible: true });
    expect(
      screen.queryByRole("heading", { name: "Payment QR" })
    ).not.toBeInTheDocument();
  });
});
