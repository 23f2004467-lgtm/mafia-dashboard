import React, { useEffect, useRef, useState } from "react";
import {
  Banner,
  Button,
  ConfirmSheet,
  HoldButton,
  Pill,
  QRPanel,
  Sheet,
} from "../../ui";
import "./Payment.css";

/**
 * Payment — §6.4. Pure white (--surface) full screen; reached only after a
 * Selected verdict (or via the pending chip / already-paid recap).
 * Presentational: the QR session, the 30 s poll, the mark-paid write and
 * every Firestore touch live in App.js — this screen renders props and
 * reports intents.
 *
 * - ₹300 header: 40 px mono tabular + "MAFIA membership fee" (§4:
 *   the Payment header amount is mono — money a human cross-checks).
 * - Two UPI radio cards (56 px), labels from the EXISTING UPI account
 *   config strings; last-used preselected (App owns the localStorage key).
 * - "Show QR" (idempotent, §2 #17 — App reuses the live session) →
 *   QRPanel with the caller-owned react-qr-code element as children.
 * - Status Banner (§2 #19): neutral waiting with the mono ticking
 *   "last check m:ss" line; timeout = amber + "Regenerate QR (n tries
 *   left)" + "Other options"; error = red + Retry. No countdown headline.
 * - Exits (§2 #18): exactly "Back" and ghost-destructive "Cancel payment"
 *   (ConfirmSheet — App passes the paymentId to cleanup, the bugfix).
 * - "Other options" → Sheet: restatement + UPI selector + 600 ms
 *   HoldButton wrapping the existing mark-paid write (§2 #15). Result
 *   pill is amber "Paid · unverified", never green.
 * - Green room (§9 #10): full-viewport 350 ms opacity crossfade to
 *   success tint; auto-advance 2.5 s or tap.
 * - Already-paid: static receipt state with "Continue".
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
  onBack,
  onCancelPayment,
  cancelBusy = false,
  greenRoom = null,
  onGreenRoomDone,
  onContinue,
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOtherOpen(true)}
              >
                Other options
              </Button>
            </div>
          }
        >
          Payment not confirmed yet.
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
            Waiting for payment — checks every 30 s ·{" "}
            <span className="pay-wait__tick">
              last check {formatElapsed(lastCheckAt, now)}
            </span>
          </span>
        </Banner>
      );
    }
  }

  return (
    <main className="pay-screen">
      <header className="pay-amount">
        <div className="pay-amount__value tnum">₹{amount}</div>
        <div className="pay-amount__label">MAFIA membership fee</div>
      </header>

      {upiSelector("main")}

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

      <div className="pay-exits">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>
          Back
        </Button>
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          destructive
          onClick={() => setCancelOpen(true)}
        >
          Cancel payment
        </Button>
      </div>

      <button
        type="button"
        className="pay-other-link"
        onClick={() => setOtherOpen(true)}
      >
        Other options
      </button>

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

      {/* §2 #15: manual mark-paid behind Other options — restatement +
          UPI selector + 600 ms hold wrapping the existing write. */}
      <Sheet
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        title="Mark as paid"
      >
        <div className="pay-markpaid">
          <p className="pay-markpaid__text">
            Mark {subject ? subject.name : ""} as paid{" "}
            <span className="pay-markpaid__amount tnum">₹{amount}</span>? Only
            do this if you can see the payment received in the UPI app. The
            board will verify it later.
          </p>
          {upiSelector("sheet")}
          <HoldButton
            label="Hold to confirm — I saw the payment"
            onConfirm={() => {
              setOtherOpen(false);
              if (onMarkPaid) onMarkPaid();
            }}
          />
        </div>
      </Sheet>

      {/* §9 #10: the green room — full-viewport opacity crossfade to the
          success tint; legible from two meters; tap or 2.5 s to advance. */}
      {greenRoom ? (
        <div
          className={"pay-greenroom" + (greenIn ? " pay-greenroom--in" : "")}
          role="status"
          onClick={() => {
            if (doneRef.current) doneRef.current();
          }}
        >
          <div className="pay-greenroom__check" aria-hidden="true">
            ✓
          </div>
          <div className="pay-greenroom__amount">PAID ₹{amount}</div>
          <div className="pay-greenroom__name">{greenRoom.name}</div>
          {greenRoom.txn ? (
            <div className="pay-greenroom__txn">{greenRoom.txn}</div>
          ) : null}
          <button type="button" className="pay-greenroom__continue">
            Continue
          </button>
        </div>
      ) : null}
    </main>
  );
}
