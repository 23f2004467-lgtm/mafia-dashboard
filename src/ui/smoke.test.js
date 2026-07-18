/**
 * Phase 2 library smoke test — renders every src/ui component with minimal
 * props and asserts nothing throws. Library-scoped (touches no app code).
 */
import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  Accordion,
  ActionBar,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  ConfirmPopover,
  ConfirmSheet,
  Dialog,
  DomainToggle,
  Drawer,
  EmptyState,
  HoldButton,
  Input,
  Select,
  Textarea,
  OfflineBanner,
  Pill,
  PresenceDot,
  derivePresence,
  QRPanel,
  ResultRow,
  SearchField,
  Sheet,
  Skeleton,
  SpectrumDots,
  Stamp,
  StatTile,
  TableRow,
  Ticket,
  formatRegNo,
  Toast,
  ToastHost,
  toast,
  TopBar,
  useFocusTrap,
} from "./index";

describe("src/ui smoke", () => {
  test("Button renders", () => {
    render(<Button>Submit verdict</Button>);
    expect(screen.getByRole("button", { name: /submit verdict/i })).toBeInTheDocument();
    render(
      <Button variant="ghost" size="lg" destructive disabled disabledReason="Pick domains or Not selected">
        Cancel payment
      </Button>
    );
    render(<Button loading>Show QR</Button>);
  });

  test("HoldButton renders", () => {
    render(<HoldButton label="Hold to confirm" onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: /hold to confirm/i })).toBeInTheDocument();
    render(<HoldButton label="Hold" onConfirm={() => {}} variant="destructive" holdMs={600} />);
  });

  test("Input / Select / Textarea render", () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    render(<Input label="WhatsApp" mono error="Required" />);
    render(
      <Select label="Year" readOnly>
        <option>1st</option>
      </Select>
    );
    render(<Textarea label="Comments" rows={4} helper="Optional" />);
  });

  test("SearchField renders", () => {
    render(<SearchField value="" onChange={() => {}} placeholder="Name or reg number" />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    render(<SearchField value="pri" onChange={() => {}} onClear={() => {}} size="admin" loading />);
  });

  test("Pill renders all 7 states", () => {
    ["registered", "checked_in", "selected", "not_selected"].forEach((state) =>
      render(<Pill track="journey" state={state} />)
    );
    ["unpaid", "paid_unverified", "verified"].forEach((state) =>
      render(<Pill track="payment" state={state} size="sm" />)
    );
    expect(screen.getAllByText("Selected ✓").length).toBeGreaterThan(0);
  });

  test("Chip variants render", () => {
    render(<Chip>2nd</Chip>);
    render(<Chip selected onToggle={() => {}} count={12}>Unpaid</Chip>);
    render(<Chip rank={1}>Dance</Chip>);
    render(<Chip onToggle={() => {}} disabled>All</Chip>);
  });

  test("DomainToggle renders", () => {
    render(<DomainToggle label="Dance" on onToggle={() => {}} />);
    render(<DomainToggle label="Not selected — no committees" negative onToggle={() => {}} />);
  });

  test("Card renders", () => {
    render(<Card padding={24}>content</Card>);
    render(<Card sunken as="section">well</Card>);
  });

  test("Ticket variants render + formatRegNo", () => {
    render(<Ticket name="Priya S" regNo="23BCE7431" yearChip="2nd" pills={<Pill track="payment" state="unpaid" />} />);
    render(<Ticket name="Walk-in" regNo="WK001" variant="walkin" />);
    render(<Ticket name="Priya S" regNo="23BCE7431" variant="compact" />);
    render(<Ticket name="Priya S" regNo="23BCE7431" condensed />);
    expect(formatRegNo("23BCE7431")).toBe("23BCE · 7431");
  });

  test("StatTile renders", () => {
    render(<StatTile label="Candidates" value="547" sub="at venue" />);
    render(<StatTile label="Awaiting verification" value="12" tone="actionable" onClick={() => {}} />);
    render(<StatTile label="Revenue" loading />);
  });

  test("Banner tones render", () => {
    ["info", "success", "warning", "error", "payment-status", "offline"].forEach((tone) =>
      render(<Banner tone={tone}>message</Banner>)
    );
    render(<Banner tone="info" action={<Button size="sm">Retry</Button>} dismissible onDismiss={() => {}}>x</Banner>);
  });

  test("EmptyState renders", () => {
    render(<EmptyState title="No candidate matches" body="Check spelling" action={<Button>Add walk-in</Button>} />);
  });

  test("Skeleton shapes render", () => {
    ["text", "row", "tile"].forEach((shape) => render(<Skeleton shape={shape} />));
  });

  test("PresenceDot renders + derivePresence", () => {
    const now = Date.now();
    render(<PresenceDot lastActive={now - 2 * 60000} now={now} />);
    render(<PresenceDot />);
    expect(derivePresence(now - 2 * 60000, now).status).toBe("active");
    expect(derivePresence(now - 10 * 60000, now).status).toBe("idle");
    expect(derivePresence(now - 40 * 60000, now).status).toBe("away");
    // §14 Phase 5: correct mono ages at the 2m/10m/40m fixtures
    expect(derivePresence(now - 2 * 60000, now).ageLabel).toBe("2m");
    expect(derivePresence(now - 10 * 60000, now).ageLabel).toBe("10m");
    expect(derivePresence(now - 40 * 60000, now).ageLabel).toBe("40m");
    expect(derivePresence(undefined, now).ageLabel).toBe("—");
  });

  test("Avatar renders", () => {
    render(<Avatar name="Priya Sharma" />);
    render(<Avatar size={40} />);
  });

  test("Stamp renders", () => {
    render(<Stamp domains={["DANCE", "MUSIC"]} />);
    render(<Stamp tone="not_selected" />);
    expect(screen.getByText("SELECTED · DANCE + MUSIC")).toBeInTheDocument();
  });

  test("Accordion renders", () => {
    render(
      <Accordion title="Dance questions" defaultOpen>
        <p>Q1</p>
      </Accordion>
    );
    expect(screen.getByRole("button", { name: /dance questions/i })).toBeInTheDocument();
  });

  test("Sheet / Drawer / Dialog render open", () => {
    render(
      <Sheet open onClose={() => {}} title="Other options">
        body
      </Sheet>
    );
    render(
      <Drawer open onClose={() => {}} title="Candidate">
        body
      </Drawer>
    );
    render(
      <Dialog open onClose={() => {}} title="Danger zone" danger typedConfirm={{ word: "RESET" }}>
        {({ confirmEnabled }) => <Button disabled={!confirmEnabled}>Reset</Button>}
      </Dialog>
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  test("ConfirmSheet renders (button and hold modes)", () => {
    render(
      <ConfirmSheet open onClose={() => {}} title="Confirm" message="Priya · ₹300" onConfirm={() => {}} />
    );
    render(
      <ConfirmSheet open onClose={() => {}} title="Mark paid" message="₹300" onConfirm={() => {}} hold danger />
    );
  });

  test("ConfirmPopover renders", () => {
    const anchor = createRef();
    render(
      <>
        <button ref={anchor}>Verify</button>
        <ConfirmPopover open onClose={() => {}} anchor={anchor} message="Priya · ₹300" onConfirm={() => {}} />
      </>
    );
  });

  test("Toast + ToastHost render, toast() emits", () => {
    render(<Toast id="t1" tone="success" message="Saved · Priya" onDone={() => {}} />);
    render(<Toast id="t2" message="Saved" undo={{ label: "Undo", onUndo: () => {}, ms: 10000 }} onDone={() => {}} />);
    render(<ToastHost position="bottom-right" />);
    expect(typeof toast("hello")).toBe("string");
  });

  test("TopBar variants render", () => {
    render(<TopBar />);
    expect(screen.getByText("MAFIA")).toBeInTheDocument();
    render(<TopBar onBack={() => {}} left={<Ticket name="P" regNo="23BCE7431" condensed />} right={<Avatar name="P" />} />);
    render(<TopBar variant="admin" left={<span>lockup</span>} />);
  });

  test("ActionBar renders", () => {
    render(
      <ActionBar onOverflow={() => {}}>
        <Button size="lg" fullWidth>Submit verdict</Button>
      </ActionBar>
    );
  });

  test("QRPanel statuses render", () => {
    render(<QRPanel status="generating" />);
    render(
      <QRPanel status="active" value="mafia@upi" code="K7F2Q9" lastChecked="0:12" banner={<Banner tone="payment-status">Waiting</Banner>}>
        <div>qr</div>
      </QRPanel>
    );
    render(<QRPanel status="timeout" triesLeft={2} />);
    render(<QRPanel status="error" triesLeft={1} />);
    render(<QRPanel status="receipt" />);
  });

  test("ResultRow renders", () => {
    render(
      <ResultRow
        name="Priya S"
        regNo="23BCE7431"
        yearChip={<Chip>2nd</Chip>}
        paymentPill={<Pill track="payment" state="unpaid" />}
        onClick={() => {}}
        flash
      />
    );
  });

  test("TableRow renders", () => {
    render(
      <table>
        <tbody>
          <TableRow onOpen={() => {}} openLabel="Open Priya" flash selected>
            <td>23BCE7431</td>
            <td>Priya S</td>
          </TableRow>
        </tbody>
      </table>
    );
  });

  test("SpectrumDots renders", () => {
    render(<SpectrumDots />);
    render(<SpectrumDots size={6} loading label="Loading" />);
  });

  test("OfflineBanner renders", () => {
    render(<OfflineBanner />);
  });

  test("useFocusTrap is a hook function", () => {
    expect(typeof useFocusTrap).toBe("function");
  });

  // §2 #38 / §7.8: `busy` HOLDS the Dialog open — Esc, scrim click, and the
  // ✕ button must all refuse to close while the async op runs (the old
  // common/Modal closed instantly on confirm; this is the fix 5e ships).
  test("Dialog busy holds open (Esc, scrim, close button all refused)", () => {
    const onClose = jest.fn();
    const { container } = render(
      <Dialog open onClose={onClose} title="Force logout all" danger busy>
        <p>working…</p>
      </Dialog>
    );

    const panel = screen.getByRole("alertdialog");
    expect(panel).toHaveAttribute("aria-busy", "true");

    fireEvent.keyDown(panel, { key: "Escape" });
    fireEvent.click(container.querySelector(".ui-dialog")); // scrim
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeDisabled();
    fireEvent.click(closeBtn);

    expect(onClose).not.toHaveBeenCalled();
  });

  test("Dialog closes normally when not busy", () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose} title="Reverse verification" danger>
        <p>body</p>
      </Dialog>
    );
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // §7.8 typed confirm: the actions slot's confirmEnabled flag flips only
  // on an exact word match, and the typed input disables while busy.
  test("Dialog typedConfirm gates the actions slot until the word matches", () => {
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Reset interview data"
        danger
        typedConfirm={{ word: "RESET" }}
        actions={({ confirmEnabled }) => (
          <Button disabled={!confirmEnabled}>Reset interview data</Button>
        )}
      >
        <p>Clears verdicts, payments, comments.</p>
      </Dialog>
    );

    const confirm = screen.getByRole("button", { name: "Reset interview data" });
    const input = screen.getByLabelText(/type/i);
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "RESE" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "RESET" } });
    expect(confirm).not.toBeDisabled();
  });
});
