import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  ConfirmPopover,
  Drawer,
  Pill,
  Ticket,
} from "../../ui";
import { deriveJourneyState } from "../../candidateState";
import "./AdminCandidateDrawer.css";

/**
 * AdminCandidateDrawer (§7.5) — the heart. Presentational: the candidate
 * object, the verify write, the reverse action, and the undo toast all live
 * in AdminPortal.jsx; this renders the full record + the confirm popover.
 *
 * - Header: compact Ticket (§11.2 — the two portals share one artifact).
 * - Body: identity block · BOTH preference sets (rank chips) · both verdict
 *   arrays as pills · comments · payment block (amount, method/UPI, txn id
 *   + verification code in mono wells, marked-by/at, amber method tag,
 *   verified-by line) · updated-by/at.
 * - Actions sit NEXT TO the payment evidence: "Verify payment" (primary,
 *   paid && !manuallyVerified) → ConfirmPopover restating name · amount ·
 *   txn · marked-by → `onVerify(candidate)` (async, resolves true on
 *   success); "Reverse verification" (destructive ghost, verified rows) →
 *   `onReverse(candidate)` (parent opens its confirm dialog).
 * - ≤ 1024px the Drawer itself goes full-screen (Drawer.css).
 */

/** §7.5 amber "manual" tag — pure derivation (Jest: manualTag.test.js).
 * True when `paymentDetails.method` indicates a manual mark-paid: the one
 * surviving manual write path stamps method "Manual"; QR confirmations
 * stamp "{type} QR ({name})". No manual txn-id prefix exists in the
 * surviving write paths (§7.5). */
export const isManualPayment = (paymentDetails) =>
  Boolean(paymentDetails && paymentDetails.method) &&
  /manual/i.test(paymentDetails.method);

/** §7.5 payment-METHOD tag (owner 2026-07-20 — "manual" purged from the UI).
 * Every confirm is a human, so "manual" is meaningless noise; the amber tag
 * now names the actual method instead. Derived from `paymentDetails.method`
 * with the noise word stripped: an explicit cash confirm → "Cash" (owner
 * truth #4; Stage C wires the mode), and a bare hand-confirm (stored method
 * "Manual") strips to nothing → "UPI" (the default collection rail). Pure;
 * stored field VALUES are untouched — this is display copy only. */
export const deriveMethodTag = (paymentDetails) => {
  const raw = (paymentDetails && paymentDetails.method) || "";
  if (!raw) return null;
  if (/cash/i.test(raw)) return "Cash";
  return raw.replace(/manual/gi, "").trim() || "UPI";
};

/** §5 Track 1 — the single source of truth (src/candidateState.js): prefers
 *  the Phase-7 verdictStatus when present, else the exact pre-Phase-7 array
 *  derivation; missing fields always render permissive (landmine #11). */
const journeyState = deriveJourneyState;

/** §5 Track 2 — same derivation the table uses. */
const paymentState = (c) =>
  c.paid ? (c.manuallyVerified ? "verified" : "paid_unverified") : "unpaid";

/** preferences.{pref1,pref2,pref3} → [{rank, label}] (empty slots dropped). */
const prefList = (prefs) =>
  [prefs?.pref1, prefs?.pref2, prefs?.pref3]
    .map((label, i) => ({ rank: i + 1, label: (label || "").trim() }))
    .filter((p) => p.label);

const verdictArray = (arr) => (Array.isArray(arr) ? arr : []);

function PrefRow({ committee, prefs }) {
  return (
    <div className="acd__pref-row">
      <span className="acd__sublabel">{committee}</span>
      {prefs.length > 0 ? (
        <div className="acd__chips">
          {prefs.map((p) => (
            <Chip key={p.rank} rank={p.rank}>
              {p.label}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="acd__muted">—</span>
      )}
    </div>
  );
}

function VerdictRow({ committee, domains }) {
  return (
    <div className="acd__pref-row">
      <span className="acd__sublabel">{committee}</span>
      {domains.length > 0 ? (
        <div className="acd__chips">
          {domains.map((d) => (
            <span key={d} className="acd__verdict-tag">
              {d}
            </span>
          ))}
        </div>
      ) : (
        <span className="acd__muted">—</span>
      )}
    </div>
  );
}

export default function AdminCandidateDrawer({
  open = false,
  candidate,
  onClose,
  onVerify,
  onReverse,
  onCheckIn,
  formatWhen,
}) {
  const verifyAnchorRef = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const canVerify = Boolean(
    candidate && candidate.paid && !candidate.manuallyVerified
  );

  // Reset the popover whenever the drawer closes or the subject changes.
  const regNo = candidate ? candidate.regNo : null;
  useEffect(() => {
    setConfirmOpen(false);
    setWorking(false);
  }, [open, regNo]);

  // If the candidate flips to verified from elsewhere (another admin, a
  // snapshot echo) while the popover is idle-open, its anchor unmounts —
  // close the popover instead of leaving it floating.
  useEffect(() => {
    if (!canVerify && confirmOpen && !working) setConfirmOpen(false);
  }, [canVerify, confirmOpen, working]);

  const handleConfirmVerify = async () => {
    if (working || !candidate) return;
    setWorking(true);
    const ok = await onVerify(candidate);
    setWorking(false);
    if (ok) setConfirmOpen(false);
  };

  if (!candidate && !open) return null;

  const pd = (candidate && candidate.paymentDetails) || null;
  const mvd = (candidate && candidate.manualVerificationDetails) || null;
  const amount = pd && pd.amount != null ? Number(pd.amount) : 300;
  const txn = (pd && pd.transactionId) || null;
  const markedBy = (candidate && candidate.lastUpdatedBy) || "—";

  return (
    <Drawer
      open={open && Boolean(candidate)}
      onClose={onClose}
      busy={working}
      className="acd-drawer"
      title={
        candidate ? (
          <Ticket
            variant="compact"
            name={candidate.name}
            regNo={candidate.regNo}
            pills={
              <>
                <Pill track="journey" state={journeyState(candidate)} size="sm" />
                <Pill track="payment" state={paymentState(candidate)} size="sm" />
              </>
            }
          />
        ) : undefined
      }
    >
      {candidate ? (
        <div className="acd">
          {/* ---------- Check-in (§2 #28 / §7.5, Phase 7b) ----------
              Additive `activated`: a single tap sets it true (optimistic +
              Undo toast in the parent). Already checked-in → a quiet state,
              never a second write. A missing field shows "Check in" and is
              fully operable — nothing here blocks (landmine #11). */}
          {onCheckIn ? (
            <section className="acd__section acd__checkin">
              <h3 className="acd__label">Check-in</h3>
              {candidate.activated === true ? (
                <p className="acd__checkin-done">✓ Checked in</p>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  onClick={() => onCheckIn(candidate)}
                >
                  Check in
                </Button>
              )}
            </section>
          ) : null}

          {/* ---------- Identity (read-only definition list) ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Details</h3>
            <dl className="acd__dl">
              <dt>Year</dt>
              <dd>{candidate.year || "—"}</dd>
              <dt>College</dt>
              <dd>{candidate.college || "—"}</dd>
              <dt>Branch</dt>
              <dd>{candidate.branch || "—"}</dd>
              <dt>WhatsApp</dt>
              <dd className="acd__mono">{candidate.whatsappNumber || "—"}</dd>
            </dl>
          </section>

          {/* ---------- BOTH preference sets ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Preferences</h3>
            <PrefRow
              committee="TalentComm"
              prefs={prefList(candidate.preferences?.talentComm)}
            />
            <PrefRow
              committee="WorkComm"
              prefs={prefList(candidate.preferences?.workComm)}
            />
          </section>

          {/* ---------- Both verdict arrays as pills ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Verdict</h3>
            <VerdictRow
              committee="TalentComm"
              domains={verdictArray(candidate.verdict?.talentComm)}
            />
            <VerdictRow
              committee="WorkComm"
              domains={verdictArray(candidate.verdict?.workComm)}
            />
          </section>

          {/* ---------- Comments ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Comments</h3>
            {candidate.comments ? (
              <p className="acd__comments">{candidate.comments}</p>
            ) : (
              <p className="acd__muted">No comments.</p>
            )}
          </section>

          {/* ---------- Payment block (the evidence) ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Payment</h3>
            <div className="acd__payment-head">
              <Pill track="payment" state={paymentState(candidate)} />
              {isManualPayment(pd) ? (
                <span className="acd__manual-tag">{deriveMethodTag(pd)}</span>
              ) : null}
            </div>

            {candidate.paid ? (
              <>
                <dl className="acd__dl">
                  <dt>Amount</dt>
                  <dd className="acd__mono">₹{amount}</dd>
                  <dt>Method</dt>
                  <dd>{(pd && pd.method) || "—"}</dd>
                  {pd && pd.upiId ? (
                    <>
                      <dt>UPI</dt>
                      <dd className="acd__mono">{pd.upiId}</dd>
                    </>
                  ) : null}
                  {pd && pd.upiName ? (
                    <>
                      <dt>UPI name</dt>
                      <dd>{pd.upiName}</dd>
                    </>
                  ) : null}
                  <dt>Marked by</dt>
                  <dd>{markedBy}</dd>
                  <dt>Marked at</dt>
                  <dd className="acd__mono">
                    {pd && pd.timestamp ? formatWhen(pd.timestamp) : "—"}
                  </dd>
                </dl>

                <div className="acd__wells">
                  <div className="acd__well-group">
                    <span className="acd__sublabel">Txn ID</span>
                    <div className="acd__well">{txn || "—"}</div>
                  </div>
                  <div className="acd__well-group">
                    <span className="acd__sublabel">Verification code</span>
                    <div className="acd__well">
                      {(pd && pd.verificationCode) || "—"}
                    </div>
                  </div>
                </div>

                {candidate.manuallyVerified ? (
                  <p className="acd__verified-line">
                    Verified by {(mvd && mvd.verifiedBy) || "Admin"}
                    {mvd && mvd.verifiedAt ? (
                      <span className="acd__mono">
                        {" "}
                        · {formatWhen(mvd.verifiedAt)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="acd__muted">No payment recorded.</p>
            )}

            {/* Actions live next to the evidence (§7.5) */}
            <div className="acd__actions">
              {canVerify ? (
                <span className="acd__verify-anchor" ref={verifyAnchorRef}>
                  <Button
                    size="sm"
                    fullWidth
                    onClick={() => setConfirmOpen(true)}
                  >
                    Verify payment
                  </Button>
                </span>
              ) : null}
              {candidate.manuallyVerified ? (
                <Button
                  variant="ghost"
                  destructive
                  size="sm"
                  fullWidth
                  onClick={() => onReverse(candidate)}
                >
                  Reverse verification
                </Button>
              ) : null}
            </div>
          </section>

          {/* ---------- Updated-by/at ---------- */}
          <section className="acd__section">
            <h3 className="acd__label">Updated</h3>
            {candidate.lastUpdatedBy || candidate.lastUpdatedAt ? (
              <p className="acd__updated">
                {candidate.lastUpdatedBy || "—"}
                {candidate.lastUpdatedAt ? (
                  <span className="acd__mono">
                    {" "}
                    · {formatWhen(candidate.lastUpdatedAt)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="acd__muted">Never updated.</p>
            )}
          </section>
        </div>
      ) : null}

      {/* Confirm popover: restates the evidence before the verify write */}
      {candidate ? (
        <ConfirmPopover
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          anchor={verifyAnchorRef}
          message={`${candidate.name} · ₹${amount} · ${txn || "no txn id"} · marked by ${markedBy}`}
          confirmLabel="Verify payment"
          onConfirm={handleConfirmVerify}
          working={working}
        />
      ) : null}
    </Drawer>
  );
}
