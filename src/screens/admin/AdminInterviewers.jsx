import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  ConfirmPopover,
  EmptyState,
  PresenceDot,
  Skeleton,
  derivePresence,
} from "../../ui";
import "./AdminInterviewers.css";

/**
 * AdminInterviewers (§7.6) — the interviewers panel. Presentational: rows
 * arrive fully derived from AdminPortal.jsx (which owns the ONE existing
 * interviewers listener — landmine #13 — and joins "N today" / "last
 * touched" over the candidates snapshot, §2 #34).
 *
 * Row: email · PresenceDot (honest §2 #32 presence from lastActive — the
 * always-green dot dies here) + mono age · "N today" · last candidate
 * touched · "End session" (ConfirmPopover stating the email → the existing
 * single-doc delete). A 1 s tick keeps ages and presence live.
 */

const SKELETON_ROWS = 3;

function InterviewerRow({
  row,
  now,
  confirmOpen,
  onAskEnd,
  onCancelEnd,
  onConfirmEnd,
  ending,
}) {
  const anchorRef = useRef(null);
  return (
    <li className="admin-ivs__row">
      <span className="admin-ivs__email" title={row.email}>
        {row.email}
      </span>
      <PresenceDot lastActive={row.lastActiveMs} now={now} />
      <span className="admin-ivs__today">{row.todayCount} today</span>
      <span
        className="admin-ivs__last"
        title={row.lastTouchedName || undefined}
      >
        {row.lastTouchedName || "—"}
      </span>
      <span ref={anchorRef} className="admin-ivs__end">
        <Button
          size="sm"
          variant="ghost"
          destructive
          onClick={onAskEnd}
          aria-haspopup="dialog"
          aria-expanded={confirmOpen}
        >
          End session
        </Button>
      </span>
      <ConfirmPopover
        open={confirmOpen}
        onClose={onCancelEnd}
        anchor={anchorRef}
        message={`End the session for ${row.email}? They will need to sign in again.`}
        confirmLabel="End session"
        onConfirm={onConfirmEnd}
        destructive
        working={ending}
      />
    </li>
  );
}

export default function AdminInterviewers({
  rows,
  ready = false,
  onEndSession,
  endingEmail,
}) {
  // 1 s tick: presence ages + statuses stay live between snapshots.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // One confirm popover open at a time.
  const [confirmEmail, setConfirmEmail] = useState(null);

  const handleConfirmEnd = async (email) => {
    await onEndSession(email);
    setConfirmEmail(null);
  };

  const activeCount = rows.filter(
    (r) => derivePresence(r.lastActiveMs, now).status === "active"
  ).length;

  let body;
  if (!ready) {
    body = (
      <ul className="admin-ivs__list">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <li className="admin-ivs__row admin-ivs__row--skeleton" key={i}>
            <Skeleton shape="text" />
          </li>
        ))}
      </ul>
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        title="No active interviewer sessions"
        body="Sessions appear here while interviewers are signed in."
      />
    );
  } else {
    body = (
      <ul className="admin-ivs__list">
        {rows.map((row) => (
          <InterviewerRow
            key={row.email}
            row={row}
            now={now}
            confirmOpen={confirmEmail === row.email}
            onAskEnd={() => setConfirmEmail(row.email)}
            onCancelEnd={() => setConfirmEmail(null)}
            onConfirmEnd={() => handleConfirmEnd(row.email)}
            ending={endingEmail === row.email}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className="admin-ivs" aria-label="Interviewers">
      <header className="admin-ivs__head">
        <h2 className="admin-ivs__title">Interviewers</h2>
        {ready ? (
          <span className="admin-ivs__meta">
            {rows.length} {rows.length === 1 ? "session" : "sessions"} ·{" "}
            {activeCount} active
          </span>
        ) : null}
      </header>
      {body}
    </section>
  );
}
