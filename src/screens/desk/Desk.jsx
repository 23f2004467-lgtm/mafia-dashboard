import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Chip,
  ConfirmPopover,
  Drawer,
  EmptyState,
  Pill,
  SearchField,
  Skeleton,
  Ticket,
  formatRegNo,
} from "../../ui";
import { deriveJourneyState, isCheckedIn, isWaiting } from "../../candidateState";
import "./Desk.css";

/**
 * Desk — the check-in desk screen (third role, owner feature 2026-07-20).
 *
 * The front-desk person's calling sheet, live: the FULL candidate list
 * (search narrows it), each row a paper card with name · mono regNo · year ·
 * journey pill · a tap-to-call WhatsApp tel: link · a slot chip when the
 * time-slot layer has data · and ONE action, "Check in". Checked-in rows
 * show the quiet "✓ Checked in {time}" state; tapping it asks
 * "Mark as not arrived?" (ConfirmPopover) before reverting.
 *
 * PRESENTATIONAL: the live candidates array and BOTH writes come from
 * App.js (`onCheckIn`, `onMarkNotArrived` — the same additive
 * activated/activatedAt update path the admin check-in uses). Nothing else
 * is writable from this screen: no verdict controls, no payment surfaces,
 * no interviewer state machine — the read-only record Drawer reuses the
 * admin drawer's record-body layout patterns (identity dl, rank chips,
 * comments) minus every action and the payment block.
 *
 * Counts: the sticky strip's live "Checked in X / Y" + "Waiting {N}" is
 * sanctioned HERE — the §9 no-counters ban is scoped to interviewer
 * surfaces, and the desk's whole job is the count. Waiting uses the §5
 * additive VIEW (isWaiting): explicitly checked in, no verdict — docs
 * without the field are simply not "waiting" (landmine #11 intact).
 *
 * Ordering: slotOrder ascending when the time-slot layer has data
 * (unslotted last), then name — no file imported → plain name order,
 * nothing breaks. Windowed: first 30 rows + "Show more".
 *
 * Aesthetic: the stage canvas language — dark canvas ≥ 900px with stage
 * inks on canvas-level text, paper below; rows are paper cards either way.
 */

const PAGE = 30;

/** Same client-side search semantics as App.js filterCandidates (§2 #21):
 *  case-insensitive name substring OR regNo prefix. The desk list is always
 *  visible, so there is no min-chars gate — the query only narrows. */
export const filterDeskRows = (candidates, queryText) => {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter(
    (candidate) =>
      candidate.name?.toLowerCase().includes(q) ||
      candidate.regNo?.toLowerCase().startsWith(q)
  );
};

/** Time-slot ordering (additive `slotOrder`, stage B): slotted first,
 *  ascending; unslotted last; ties and the no-data case fall back to name. */
export const compareDeskRows = (a, b) => {
  const ao = typeof a.slotOrder === "number" ? a.slotOrder : Infinity;
  const bo = typeof b.slotOrder === "number" ? b.slotOrder : Infinity;
  if (ao !== bo) return ao - bo;
  return (a.name || "").localeCompare(b.name || "");
};

/** Firestore Timestamp | ISO string → Date (same tolerance as AdminPortal). */
const toDate = (stamp) => {
  if (!stamp) return null;
  const d = stamp.seconds ? new Date(stamp.seconds * 1000) : new Date(stamp);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** activatedAt → "9:41 am" (null while the serverTimestamp is in flight or
 *  for pre-activatedAt check-ins — the state then reads plain "Checked in"). */
const formatClock = (stamp) => {
  const d = toDate(stamp);
  return d
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
};

const docKeyOf = (cand) => cand.id || cand.regNo;

/** preferences.{pref1..3} → [{rank, label}] (admin drawer's prefList shape). */
const prefList = (prefs) =>
  [prefs?.pref1, prefs?.pref2, prefs?.pref3]
    .map((label, i) => ({ rank: i + 1, label: (label || "").trim() }))
    .filter((p) => p.label);

function PrefRow({ committee, prefs }) {
  return (
    <div className="desk-rec__pref-row">
      <span className="desk-rec__sublabel">{committee}</span>
      {prefs.length > 0 ? (
        <div className="desk-rec__chips">
          {prefs.map((p) => (
            <Chip key={p.rank} rank={p.rank}>
              {p.label}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="desk-rec__muted">—</span>
      )}
    </div>
  );
}

export default function Desk({
  candidates = [],
  loaded = false,
  onCheckIn,
  onMarkNotArrived,
  busyKey = null,
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  // Windowing: first 30 + "Show more"; the window resets on a new query.
  const [windowCount, setWindowCount] = useState(PAGE);
  useEffect(() => {
    setWindowCount(PAGE);
  }, [q]);

  // "Mark as not arrived?" popover: the candidate asked about + the tapped
  // row-button as the anchor. Rendered at screen root — never inside a
  // transformed ancestor (ConfirmPopover caveat, §5 inventory).
  const [notArrivedFor, setNotArrivedFor] = useState(null);
  const [notArrivedWorking, setNotArrivedWorking] = useState(false);
  const popAnchorRef = useRef(null);

  // Read-only record drawer: doc key kept through the exit animation; the
  // candidate itself is derived LIVE from the candidates array.
  const [recordKey, setRecordKey] = useState(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const recordCandidate = useMemo(
    () =>
      recordKey
        ? candidates.find((c) => docKeyOf(c) === recordKey) || null
        : null,
    [candidates, recordKey]
  );
  useEffect(() => {
    if (recordOpen && recordKey && loaded && !recordCandidate) {
      setRecordOpen(false); // open record vanished from the snapshot
    }
  }, [recordOpen, recordKey, loaded, recordCandidate]);

  // 150 ms skeleton grace while the first snapshot loads (§6.2 pattern).
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (loaded) {
      setGraceElapsed(false);
      return undefined;
    }
    const t = setTimeout(() => setGraceElapsed(true), 150);
    return () => clearTimeout(t);
  }, [loaded]);

  // Live counts over the whole operation (not the filtered view).
  const total = candidates.length;
  const checkedIn = useMemo(
    () => candidates.filter(isCheckedIn).length,
    [candidates]
  );
  const waiting = useMemo(
    () => candidates.filter(isWaiting).length,
    [candidates]
  );

  const rows = useMemo(
    () => filterDeskRows(candidates, q).slice().sort(compareDeskRows),
    [candidates, q]
  );
  const visible = rows.slice(0, windowCount);
  const remaining = rows.length - visible.length;

  const askNotArrived = (cand) => (event) => {
    popAnchorRef.current = event.currentTarget;
    setNotArrivedFor(cand);
  };

  const confirmNotArrived = async () => {
    if (notArrivedWorking || !notArrivedFor) return;
    setNotArrivedWorking(true);
    const ok = await onMarkNotArrived(notArrivedFor);
    setNotArrivedWorking(false);
    if (ok) setNotArrivedFor(null);
  };

  const openRecord = (cand) => {
    setRecordKey(docKeyOf(cand));
    setRecordOpen(true);
  };

  const renderAction = (cand) => {
    const key = docKeyOf(cand);
    if (cand.activated === true) {
      const clock = formatClock(cand.activatedAt);
      return (
        <button
          type="button"
          className="desk-row__checked"
          onClick={askNotArrived(cand)}
        >
          ✓ Checked in{clock ? ` ${clock}` : ""}
        </button>
      );
    }
    return (
      <Button
        size="sm"
        variant="secondary"
        loading={busyKey === key}
        onClick={() => onCheckIn(cand)}
      >
        Check in
      </Button>
    );
  };

  return (
    <div className="desk">
      <div className="desk__inner">
        <h1 className="desk__title">Check-in desk</h1>

        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Name or reg number"
          size="interviewer"
        />

        {/* Sticky live counts — the desk's job at a glance */}
        <div className="desk__counts" role="status">
          <span className="desk__count">
            <span className="desk__count-label">Checked in</span>
            <span className="desk__count-num tnum">
              {loaded ? `${checkedIn} / ${total}` : "—"}
            </span>
          </span>
          <span className="desk__count desk__count--waiting">
            <span className="desk__count-label">Waiting</span>
            <span className="desk__count-num tnum">
              {loaded ? waiting : "—"}
            </span>
          </span>
        </div>

        {!loaded ? (
          graceElapsed ? (
            <div className="desk__skeletons" aria-hidden="true">
              <Skeleton shape="row" />
              <Skeleton shape="row" />
              <Skeleton shape="row" />
            </div>
          ) : null
        ) : rows.length > 0 ? (
          <>
            <div className="desk__list">
              {visible.map((cand) => {
                const key = docKeyOf(cand);
                return (
                  <div key={key} className="desk-row">
                    <div className="desk-row__top">
                      <button
                        type="button"
                        className="desk-row__main"
                        onClick={() => openRecord(cand)}
                      >
                        <span className="desk-row__name-line">
                          <span className="desk-row__name">{cand.name}</span>
                          {cand.slot ? <Chip>{cand.slot}</Chip> : null}
                        </span>
                        <span className="desk-row__meta-line">
                          <span className="desk-row__regno">
                            {formatRegNo(cand.regNo)}
                          </span>
                          {cand.year ? (
                            <span className="desk-row__year">{cand.year}</span>
                          ) : null}
                          <Pill
                            track="journey"
                            state={deriveJourneyState(cand)}
                            size="sm"
                          />
                        </span>
                      </button>
                      <span className="desk-row__action">
                        {renderAction(cand)}
                      </span>
                    </div>
                    {cand.whatsappNumber ? (
                      <a
                        className="desk-row__call"
                        href={`tel:${cand.whatsappNumber}`}
                        aria-label={`Call ${cand.name}`}
                      >
                        <svg
                          className="desk-row__call-icon"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M4 3h3l1.5 4L6.8 8.6a11 11 0 0 0 4.6 4.6L13 11.5l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A14.5 14.5 0 0 1 2.5 4.6 1.5 1.5 0 0 1 4 3Z" />
                        </svg>
                        <span className="desk-row__call-num">
                          {cand.whatsappNumber}
                        </span>
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {remaining > 0 ? (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setWindowCount((n) => n + PAGE)}
              >
                Show more ({remaining})
              </Button>
            ) : null}
          </>
        ) : q ? (
          <EmptyState
            title={`No candidate matches “${q}”`}
            body="Check the reg number spelling — walk-ins are added by interviewers."
          />
        ) : (
          <EmptyState
            title="No candidates yet"
            body="Registered candidates appear here live."
          />
        )}
      </div>

      {/* "Mark as not arrived?" — reverting a check-in gets one calm ask */}
      <ConfirmPopover
        open={notArrivedFor != null}
        onClose={() => setNotArrivedFor(null)}
        anchor={popAnchorRef}
        message={
          notArrivedFor
            ? `Mark ${notArrivedFor.name} as not arrived?`
            : undefined
        }
        confirmLabel="Mark not arrived"
        destructive
        working={notArrivedWorking}
        onConfirm={confirmNotArrived}
      />

      {/* The FULL read-only record (admin drawer record-body patterns):
          identity · prefs · phone · pills · comments. NO verdict controls,
          NO payment block, no writes beyond the check-in action. */}
      <Drawer
        open={recordOpen && Boolean(recordCandidate)}
        onClose={() => setRecordOpen(false)}
        className="desk-rec-drawer"
        title={
          recordCandidate ? (
            <Ticket
              variant="compact"
              name={recordCandidate.name}
              regNo={recordCandidate.regNo}
              pills={
                <Pill
                  track="journey"
                  state={deriveJourneyState(recordCandidate)}
                  size="sm"
                />
              }
            />
          ) : undefined
        }
      >
        {recordCandidate ? (
          <div className="desk-rec">
            <section className="desk-rec__section">
              <h3 className="desk-rec__label">Check-in</h3>
              {recordCandidate.activated === true ? (
                <p className="desk-rec__checkin-done">
                  ✓ Checked in
                  {formatClock(recordCandidate.activatedAt)
                    ? ` ${formatClock(recordCandidate.activatedAt)}`
                    : ""}
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  loading={busyKey === docKeyOf(recordCandidate)}
                  onClick={() => onCheckIn(recordCandidate)}
                >
                  Check in
                </Button>
              )}
            </section>

            <section className="desk-rec__section">
              <h3 className="desk-rec__label">Details</h3>
              <dl className="desk-rec__dl">
                <dt>Year</dt>
                <dd>{recordCandidate.year || "—"}</dd>
                <dt>College</dt>
                <dd>{recordCandidate.college || "—"}</dd>
                <dt>Branch</dt>
                <dd>{recordCandidate.branch || "—"}</dd>
                <dt>WhatsApp</dt>
                <dd className="desk-rec__mono">
                  {recordCandidate.whatsappNumber ? (
                    <a
                      className="desk-rec__tel"
                      href={`tel:${recordCandidate.whatsappNumber}`}
                    >
                      {recordCandidate.whatsappNumber}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                {recordCandidate.slot ? (
                  <>
                    <dt>Slot</dt>
                    <dd className="desk-rec__mono">{recordCandidate.slot}</dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section className="desk-rec__section">
              <h3 className="desk-rec__label">Preferences</h3>
              <PrefRow
                committee="TalentComm"
                prefs={prefList(recordCandidate.preferences?.talentComm)}
              />
              <PrefRow
                committee="WorkComm"
                prefs={prefList(recordCandidate.preferences?.workComm)}
              />
            </section>

            <section className="desk-rec__section">
              <h3 className="desk-rec__label">Comments</h3>
              {recordCandidate.comments ? (
                <p className="desk-rec__comments">{recordCandidate.comments}</p>
              ) : (
                <p className="desk-rec__muted">No comments.</p>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
