import React, { useEffect, useRef, useState } from "react";
import {
  ActionBar,
  Banner,
  Button,
  CelebrationBurst,
  CelebrationCheck,
  ConfirmSheet,
  HoldButton,
  Pill,
  QRPanel,
  Sheet,
  formatRegNo,
} from "../../ui";
import "./Payment.css";

/**
 * Payment — §6.4, reworked per the owner flow correction (2026-07-20):
 * there is NO automatic payment confirmation in reality — no gateway, no
 * bank sync; the 30 s paymentSessions poll never receives external writes.
 * The INTERVIEWER is the confirmer: they watch the payment land (club UPI
 * app / candidate's success screen) and mark it. Manual confirm-by-
 * interviewer is therefore the PRIMARY action — the old §2 #15 "Other
 * options" burial assumed QR auto-confirm was primary; that assumption is
 * retired. Presentational: the QR session, the 30 s poll, the mark-paid
 * write and every Firestore touch live in App.js — this screen renders
 * props and reports intents (all handlers byte-identical to the old flow;
 * only their UI seats moved).
 *
 * The screen joins the stage format (≥ 900px night canvas via
 * .iv-screen--payment in Chrome.css; phones keep the paper canvas) and
 * reads as zone panels — the candidate screen's zone language:
 * - AMOUNT zone: condensed identity (name + mono regNo, [data-iv-ticket]
 *   so the Chrome TopBar dedups it) + the ₹300 mono display (§4: money a
 *   human cross-checks is mono) + "MAFIA membership fee".
 * - ACCOUNT zone: the two UPI radio cards (56 px), labels from the
 *   EXISTING UPI config strings; last-used preselected (App owns the
 *   localStorage key).
 * - QR zone: "Show QR" primary (idempotent, §2 #17 — App reuses the live
 *   session; Regenerate only in timeout/error, tries-left capped) →
 *   QRPanel with its WHITE CARD preserved exactly (scan contrast is law);
 *   on the ≥ 900px stage the live zone panel dissolves so the white QR
 *   card floats on the night. Status banner stays with the QR zone,
 *   worded honestly: the poll line never implies auto-confirm is the
 *   primary path.
 * - Sticky ActionBar: the PRIMARY is the 600 ms HoldButton ("Hold to
 *   confirm — ₹300 received", money-touch friction preserved) wired to
 *   the exact same mark-paid handler the buried sheet used; the
 *   {name} + ₹300 restatement sits directly above the hold (evidence-on-
 *   screen law). Always available while the screen shows (mirrors the old
 *   always-rendered "Other options" link). Result pill stays amber
 *   "Paid · unverified", never green — the board still verifies.
 *   The "⋯" overflow menu holds the two verdict correctives — Undo verdict
 *   (only while `canUndoVerdict`, self-retiring on any payment activity) and
 *   Edit verdict (always → Candidate for a clean resubmit) — plus Cancel
 *   payment (ConfirmSheet — App passes the paymentId to cleanup, the bugfix).
 *   Back is the TopBar chevron.
 * - Green room (§9 #10): full-viewport 350 ms opacity crossfade to
 *   success tint; auto-advance 2.5 s or tap.
 * - Already-paid: static receipt state (paper card) with "Continue".
 */

/** §5 Track 2 — payment pill state from existing paid/manuallyVerified. */
const derivePaymentState = (cand) =>
  cand && cand.paid
    ? cand.manuallyVerified
      ? "verified"
      : "paid_unverified"
    : "unpaid";

const formatElapsed = (from, now) => {
  if (!from) return "0:00";
  const fromMs = from instanceof Date ? from.getTime() : from;
  const s = Math.max(0, Math.floor((now - fromMs) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Payment({
  subject,
  amount = "300",
  upiAccounts = [],
  selectedUpi = 0,
  onSelectUpi,
  qrVisible = false,
  qrElement = null,
  verificationCode = "",
  sessionUpiId = null,
  status = "pending",
  generating = false,
  errorMessage = "",
  lastCheckAt = null,
  triesLeft = 0,
  onShowQR,
  onRegenerate,
  onMarkPaid,
  onCancelPayment,
  cancelBusy = false,
  canUndoVerdict = false,
  onUndoVerdict,
  onEditVerdict,
  greenRoom = null,
  onGreenRoomDone,
  onContinue,
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Mono ticking "last check m:ss" (server truth is the poll; this only
  // renders honesty about when it last ran — JS-driven text, no keyframes).
  const waiting = qrVisible && status === "pending";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  // Green room: two-phase class flip for the 350 ms opacity crossfade
  // (transition, not a keyframe) + 2.5 s auto-advance (or tap). The done
  // callback lives in a ref so parent re-renders never restart the timer.
  const [greenIn, setGreenIn] = useState(false);
  const doneRef = useRef(onGreenRoomDone);
  useEffect(() => {
    doneRef.current = onGreenRoomDone;
  });
  useEffect(() => {
    if (!greenRoom) {
      setGreenIn(false);
      return undefined;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGreenIn(true));
    });
    const t = setTimeout(() => {
      if (doneRef.current) doneRef.current();
    }, 2500);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [greenRoom]);

  const isTimeout = status === "timeout";
  const isError = status === "error" || status === "failed";

  const upiSelector = (idPrefix) => (
    <div className="pay-upi" role="radiogroup" aria-label="UPI account">
      {upiAccounts.map((upi, i) => (
        <button
          key={`${idPrefix}-${upi.id}`}
          type="button"
          role="radio"
          aria-checked={selectedUpi === i}
          className={
            "pay-upi__card" + (selectedUpi === i ? " pay-upi__card--on" : "")
          }
          onClick={() => onSelectUpi && onSelectUpi(i)}
        >
          <span className="pay-upi__radio" aria-hidden="true" />
          <span className="pay-upi__text">
            <span className="pay-upi__name">{upi.name}</span>
            <span className="pay-upi__type">{upi.type}</span>
          </span>
        </button>
      ))}
    </div>
  );

  // ---------- Already-paid: static receipt state ----------
  if (subject && subject.paid && !greenRoom) {
    const details = subject.paymentDetails || null;
    const verified = !!subject.manuallyVerified;
    return (
      <main className="pay-screen">
        <section className="pay-receipt">
          {verified ? (
            <Banner tone="success">Payment verified</Banner>
          ) : (
            <Banner tone="warning">
              Paid — awaiting board verification
            </Banner>
          )}
          <div className="pay-receipt__pill">
            <Pill track="payment" state={derivePaymentState(subject)} />
          </div>
          <dl className="pay-receipt__details">
            <div className="pay-receipt__row">
              <dt>Amount</dt>
              <dd className="tnum">₹{(details && details.amount) || amount}</dd>
            </div>
            {details && details.transactionId ? (
              <div className="pay-receipt__row">
                <dt>Txn</dt>
                <dd>{details.transactionId}</dd>
              </div>
            ) : null}
            {details && details.method ? (
              <div className="pay-receipt__row">
                <dt>Method</dt>
                <dd>{details.method}</dd>
              </div>
            ) : null}
            {details && details.timestamp ? (
              <div className="pay-receipt__row">
                <dt>Time</dt>
                <dd>{new Date(details.timestamp).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
          <Button variant="primary" size="lg" fullWidth onClick={onContinue}>
            Continue
          </Button>
        </section>
      </main>
    );
  }

  // ---------- Status banner (inside the QRPanel slot) ----------
  // Honest wording (owner call 2026-07-20): the poll line never implies
  // automatic confirmation is the primary path — the interviewer is.
  let statusBanner = null;
  if (qrVisible) {
    if (isTimeout) {
      statusBanner = (
        <Banner
          tone="warning"
          action={
            <div className="pay-banner-actions">
              <Button
                variant="secondary"
                size="sm"
                disabled={triesLeft <= 0}
                disabledReason={triesLeft <= 0 ? "No tries left" : undefined}
                onClick={onRegenerate}
              >
                Regenerate QR ({triesLeft} {triesLeft === 1 ? "try" : "tries"}{" "}
                left)
              </Button>
            </div>
          }
        >
          Auto-check stopped — if the payment landed, confirm below.
        </Banner>
      );
    } else if (isError) {
      statusBanner = (
        <Banner
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={onRegenerate}>
              Retry
            </Button>
          }
        >
          {errorMessage || "Payment check failed."}
        </Banner>
      );
    } else {
      statusBanner = (
        <Banner tone="payment-status">
          <span className="pay-wait">
            <span className="pay-wait__dot" aria-hidden="true" />
            QR shown — confirm below once you see the payment land ·{" "}
            <span className="pay-wait__tick">
              last check {formatElapsed(lastCheckAt, now)}
            </span>
          </span>
        </Banner>
      );
    }
  }

  const subjectName = subject ? subject.name || subject.regNo : "";

  return (
    <main className="pay-screen">
      {/* ---------- Amount zone: condensed identity + the mono ₹300 ----------
          [data-iv-ticket]: the Chrome TopBar's IntersectionObserver
          sentinel — the condensed bar identity appears only once this
          scrolls out of view (ticket dedup — never both at once). */}
      <section className="pay-zone" aria-label="Amount">
        <div className="pay-zone__head">
          <h2 className="pay-zone__label">Amount</h2>
        </div>
        {subject && (subject.name || subject.regNo) ? (
          <div className="pay-who" data-iv-ticket="">
            {subject.name ? (
              <span className="pay-who__name">{subject.name}</span>
            ) : null}
            {subject.regNo ? (
              <span className="pay-who__regno">
                {formatRegNo(subject.regNo)}
              </span>
            ) : null}
          </div>
        ) : null}
        <header className="pay-amount">
          <div className="pay-amount__value tnum">₹{amount}</div>
          <div className="pay-amount__label">MAFIA membership fee</div>
        </header>
      </section>

      {/* ---------- Account zone: the two UPI radio cards ---------- */}
      <section className="pay-zone" aria-label="UPI account">
        <div className="pay-zone__head">
          <h2 className="pay-zone__label">Account</h2>
          <span className="pay-zone__helper">collecting to</span>
        </div>
        {upiSelector("main")}
      </section>

      {/* ---------- QR zone: the white card on the stage ----------
          On the ≥ 900px night canvas the LIVE zone panel dissolves
          (pay-zone--live) so the white QR card floats on the night. */}
      <section
        className={"pay-zone pay-zone--qr" + (qrVisible ? " pay-zone--live" : "")}
        aria-label="Payment QR"
      >
        <div className="pay-zone__head">
          <h2 className="pay-zone__label">Payment QR</h2>
          <span className="pay-zone__helper">scan with any UPI app</span>
        </div>
        {!qrVisible ? (
          <div className="pay-generate">
            {errorMessage ? (
              <Banner
                tone="error"
                action={
                  <Button variant="secondary" size="sm" onClick={onShowQR}>
                    Retry
                  </Button>
                }
              >
                {errorMessage}
              </Banner>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={generating}
              onClick={onShowQR}
            >
              Show QR
            </Button>
          </div>
        ) : (
          <QRPanel
            value={sessionUpiId}
            code={verificationCode}
            status={isTimeout ? "timeout" : isError ? "error" : "active"}
            banner={statusBanner}
          >
            {qrElement}
          </QRPanel>
        )}
      </section>

      {/* ---------- Sticky ActionBar: hold-to-confirm is THE primary ----------
          Owner call 2026-07-20: the interviewer is the confirmer. The
          {name} + ₹300 restatement is visible at the moment of holding;
          onMarkPaid is the EXACT handler the buried sheet used. */}
      <ActionBar busy={cancelBusy} onOverflow={() => setMenuOpen(true)}>
        <div className="pay-confirm">
          <p className="pay-confirm__evidence">
            <span className="pay-confirm__amount tnum">₹{amount}</span> from{" "}
            {subjectName} · board verifies later
          </p>
          <HoldButton
            label={`Hold to confirm — ₹${amount} received`}
            onConfirm={() => {
              if (onMarkPaid) onMarkPaid();
            }}
          />
        </div>
      </ActionBar>

      {/* "⋯" overflow → the two verdict correctives + Cancel payment (the
          exits besides the TopBar back chevron). Owner 2026-07-20: a user who
          realizes they picked the wrong verdict has BOTH doors from Payment —
          Undo verdict (only while the capability is still alive, i.e. BEFORE
          any QR/hold/payment activity; App retires it exactly as on Done) and
          Edit verdict (always → back to Candidate for a clean resubmit, which
          preserves payment). Payment itself stays admin-corrected. */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Options">
        <div className="pay-menu">
          {canUndoVerdict ? (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                setMenuOpen(false);
                if (onUndoVerdict) onUndoVerdict();
              }}
            >
              Undo verdict
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              setMenuOpen(false);
              if (onEditVerdict) onEditVerdict();
            }}
          >
            Edit verdict
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            destructive
            onClick={() => {
              setMenuOpen(false);
              setCancelOpen(true);
            }}
          >
            Cancel payment
          </Button>
        </div>
      </Sheet>

      {/* §2 #18 exit two: Cancel payment — App passes paymentId to cleanup */}
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel payment?"
        message={`Stop collecting ₹${amount} from ${
          subject ? subject.name : ""
        }? The QR stops working; payment can be started again later.`}
        confirmLabel="Cancel payment"
        cancelLabel="Keep waiting"
        danger
        busy={cancelBusy}
        onConfirm={onCancelPayment}
      />

      {/* §9 #10: the green room — full-viewport opacity crossfade to the
          success tint; legible from two meters; tap or 2.5 s to advance.
          CELEBRATION (owner 2026-07-20): payment lands here only for a
          SELECTED candidate, so this is the full beat — the drawn tick
          (circle 80–540ms, tick 540–780ms), the pop + ONE ring pulse at
          780ms, the spectrum confetti burst at 820ms (all bits gone by
          ≈2290ms, inside the untouched 2.5s advance), the amount settling
          at 260–740ms, name/txn/Continue rising staggered (430/560/700).
          All decoration is aria-hidden; the role=status facts are the
          same text as before — the celebration frames them, never
          obscures them. Reduced motion: the tick renders complete, the
          burst never renders (CelebrationBurst returns null). */}
      {greenRoom ? (
        <div
          className={"pay-greenroom" + (greenIn ? " pay-greenroom--in" : "")}
          role="status"
          onClick={() => {
            if (doneRef.current) doneRef.current();
          }}
        >
          <div className="pay-greenroom__stage" aria-hidden="true">
            <CelebrationCheck size={108} drawn ring tempo="full" />
            <CelebrationBurst />
          </div>
          <div className="pay-greenroom__amount celebrate-once">
            PAID ₹{amount}
          </div>
          <div className="pay-greenroom__name celebrate-once">
            {greenRoom.name}
          </div>
          {greenRoom.txn ? (
            <div className="pay-greenroom__txn celebrate-once">
              {greenRoom.txn}
            </div>
          ) : null}
          <button
            type="button"
            className="pay-greenroom__continue celebrate-once"
          >
            Continue
          </button>
        </div>
      ) : null}
    </main>
  );
}
