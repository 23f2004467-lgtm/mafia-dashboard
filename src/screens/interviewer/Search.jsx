import React, { useEffect, useRef, useState } from "react";
import {
  Banner,
  Button,
  Chip,
  EmptyState,
  Pill,
  ResultRow,
  SearchField,
  Skeleton,
  formatRegNo,
} from "../../ui";
import {
  deriveJourneyState as deriveJourneyStateShared,
  deriveInterviewerPayment,
} from "../../candidateState";
import "./Search.css";

/**
 * Search — home (§6.2). Presentational: the live filter, debounce and the
 * in-memory candidates array live in App.js; this screen only renders.
 *
 * - Title "Find candidate", 56 px SearchField ("Name or reg number").
 * - Draft-resume Banner when a localStorage draft exists — never silent.
 * - Result rows: name · mono regNo · year Chip · payment Pill · chevron;
 *   first 20 then "Show all {N}" (§2 #22). Min query 2 chars.
 * - Empty state with "Add walk-in" + a permanent quiet walk-in link.
 * - 3 skeleton rows after a 150 ms grace while the first snapshot loads.
 * - "My recent": last 5 candidates this interviewer touched (App owns the
 *   mafia.recentCandidates localStorage key), compact rows with pills. On
 *   phones an inline section; at >= 900px a collapsible right sidebar on
 *   the stage canvas (collapse persisted under mafia.recentsSidebar, slim
 *   reopen tab when collapsed). Both placements carry the owner-requested
 *   quiet "Clear" (App.js wipes mafia.recentCandidates — no confirm:
 *   recents are a convenience cache, never data).
 * - WAITING ROOM (2026-07-20): with the query empty, the live list of
 *   candidates the desk has checked in who have no verdict yet — App.js
 *   derives it (§5 isWaiting, an additive VIEW; landmine #11 untouched)
 *   from the same app-level candidates listener the desk writes into,
 *   sorted longest-waiting first. ResultRow rows with the journey pill
 *   visible, first 8 + "Show all {N}", section hidden at 0. The header
 *   count follows the Results-head language — the same number as the
 *   sanctioned "Show all {N}", a list-size affordance, never an
 *   interviewer progress counter (§2 #34).
 * - Autofocus only when arriving via "Next candidate" (§2 #45).
 */

/** §5 Track 1 — the single source of truth (src/candidateState.js): prefers
 *  the Phase-7 verdictStatus when present, falls back to the exact pre-Phase-7
 *  array derivation on old docs; missing fields always render permissive
 *  (landmine #11). */
const deriveJourneyState = deriveJourneyStateShared;

const FIRST_PAGE = 20;
const STAGGER_ROWS = 8; // §9.2: first 8 rows stagger, later rows instant
const WAITING_FIRST = 8; // waiting room: first 8 + "Show all {N}"

// The >= 900px recents-sidebar collapse, persisted per device. View state
// only (no Firebase, no role logic) — it lives with the screen, like the
// desk's query. Default: open.
const SIDEBAR_KEY = "mafia.recentsSidebar";

const readSidebarCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
};

/** One "My recent" row — shared by the inline (phone) section and the
 *  >= 900px sidebar so both placements stay pixel-identical paper cards. */
function RecentRow({ cand, onOpen }) {
  return (
    <button
      type="button"
      className="iv-search__recent-row"
      onClick={() => onOpen(cand)}
    >
      <span className="iv-search__recent-main">
        <span className="iv-search__recent-name">{cand.name}</span>
        <span className="iv-search__recent-regno">
          {formatRegNo(cand.regNo)}
        </span>
      </span>
      <span className="iv-search__recent-pills">
        <Pill track="journey" state={deriveJourneyState(cand)} size="sm" />
        <Pill
          track="paymentIv"
          state={deriveInterviewerPayment(cand)}
          size="sm"
        />
      </span>
    </button>
  );
}

export default function Search({
  query,
  onQueryChange,
  results,
  loading = false,
  draft = null,
  onResumeDraft,
  onDiscardDraft,
  recents = [],
  waiting = [],
  onSelect,
  onSelectRecent,
  onAddWalkIn,
  onClearRecents,
  autoFocus = false,
}) {
  const q = query.trim();
  const active = q.length >= 2;

  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [q]);

  // Waiting room windowing: first 8 + "Show all {N}" (resets with the
  // section — it only renders while the query is empty).
  const [waitingAll, setWaitingAll] = useState(false);
  useEffect(() => {
    if (active) setWaitingAll(false);
  }, [active]);

  // >= 900px recents sidebar: collapse state persisted per device. Both
  // class flips stay transform/opacity-only in CSS (§9) — the panel exits
  // with --ease, enters with the one spring, and the slim reopen tab does
  // the mirror-image swap.
  const [sideCollapsed, setSideCollapsed] = useState(readSidebarCollapsed);
  const setSidebar = (collapsed) => {
    setSideCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // Private mode: the session still collapses/expands, just unpersisted.
    }
  };

  // 150 ms skeleton grace (§6.2): only while the first snapshot is pending.
  const showLoading = active && loading;
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (!showLoading) {
      setGraceElapsed(false);
      return undefined;
    }
    const t = setTimeout(() => setGraceElapsed(true), 150);
    return () => clearTimeout(t);
  }, [showLoading]);

  // §9.2 result entrance: stagger on a FRESH query (inactive → active),
  // never on re-filter keystrokes. Two-phase class flip — transitions only,
  // no new keyframes.
  const [entered, setEntered] = useState(true);
  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      setEntered(false);
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      wasActiveRef.current = true;
      return () => cancelAnimationFrame(raf1);
    }
    wasActiveRef.current = active;
    return undefined;
  }, [active]);

  const visible = showAll ? results : results.slice(0, FIRST_PAGE);

  return (
    <div className="iv-search">
      {/* Owner-sanctioned ambient collage (§2 #49 — the conversation happened):
          sleeve-embroidery art ghosted into the paper, the deep jacket-violet
          tint baked into the PNGs, CSS carries only opacity + placement.
          Desktop-only, static, behind everything. */}
      <div className="iv-search__ambient" aria-hidden="true">
        <img
          className="iv-search__ambient-print"
          src="/brand/login-stage-a.jpg"
          alt=""
          draggable={false}
        />
      </div>

      <div className="iv-search__inner">
      {draft ? (
        <div className="iv-search__draft">
          <Banner
            tone="warning"
            action={
              <>
                <Button variant="secondary" size="sm" onClick={onResumeDraft}>
                  Resume
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  destructive
                  onClick={onDiscardDraft}
                >
                  Discard
                </Button>
              </>
            }
          >
            Resume {draft.name} (
            <span className="iv-search__draft-regno">
              {formatRegNo(draft.regNo)}
            </span>
            )?
          </Banner>
        </div>
      ) : null}

      <h1 className="iv-search__title">Find candidate</h1>

      <SearchField
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onClear={() => onQueryChange("")}
        placeholder="Name or reg number"
        size="interviewer"
        autoFocus={autoFocus}
      />

      {/* WAITING ROOM (2026-07-20): the desk's live queue, empty-query only.
          Rows are standard ResultRows; the journey pill rides the pill slot
          beside payment (no new props). Sorted by App: longest-waiting
          first. Hidden entirely at 0. */}
      {!active && waiting.length > 0 ? (
        <section className="iv-search__waiting" aria-label="Waiting room">
          <div className="iv-search__results-head">
            <h2 className="iv-search__micro-label">Waiting room</h2>
            <span className="iv-search__results-count tnum">
              {waiting.length}
            </span>
          </div>
          <div className="iv-search__list">
            {(waitingAll ? waiting : waiting.slice(0, WAITING_FIRST)).map(
              (cand) => (
                <ResultRow
                  key={cand.id || cand.regNo}
                  name={cand.name}
                  regNo={cand.regNo}
                  yearChip={cand.year ? <Chip>{cand.year}</Chip> : null}
                  paymentPill={
                    <>
                      <Pill
                        track="journey"
                        state={deriveJourneyState(cand)}
                        size="sm"
                      />
                      <Pill
                        track="paymentIv"
                        state={deriveInterviewerPayment(cand)}
                        size="sm"
                      />
                    </>
                  }
                  onClick={() => onSelect(cand)}
                />
              )
            )}
          </div>
          {!waitingAll && waiting.length > WAITING_FIRST ? (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setWaitingAll(true)}
            >
              Show all {waiting.length}
            </Button>
          ) : null}
        </section>
      ) : null}

      {/* My recent, inline — phones and 768–900 keep this section; at
          >= 900px CSS hides it and the sidebar carries the same rows. */}
      {!active && recents.length > 0 ? (
        <section className="iv-search__recent" aria-label="My recent">
          <div className="iv-search__recent-head">
            <h2 className="iv-search__micro-label">My recent</h2>
            <button
              type="button"
              className="iv-search__clear-btn"
              onClick={onClearRecents}
            >
              Clear
            </button>
          </div>
          <div className="iv-search__recent-list">
            {recents.map((cand) => (
              <RecentRow
                key={cand.regNo}
                cand={cand}
                onOpen={onSelectRecent || onSelect}
              />
            ))}
          </div>
        </section>
      ) : null}

      {active ? (
        <div className="iv-search__results">
          {showLoading ? (
            graceElapsed ? (
              <div className="iv-search__skeletons" aria-hidden="true">
                <Skeleton shape="row" />
                <Skeleton shape="row" />
                <Skeleton shape="row" />
              </div>
            ) : null
          ) : results.length > 0 ? (
            <>
              <div className="iv-search__results-head">
                <h2 className="iv-search__micro-label">Results</h2>
                <span className="iv-search__results-count tnum">
                  {results.length}
                </span>
              </div>
              <div
                className={
                  "iv-search__list" + (entered ? " iv-search__list--in" : "")
                }
              >
                {visible.map((cand, i) => (
                  <div
                    key={cand.id || cand.regNo}
                    className="iv-search__list-item"
                    style={
                      i < STAGGER_ROWS
                        ? { transitionDelay: `calc(${i} * var(--stagger))` }
                        : undefined
                    }
                  >
                    <ResultRow
                      name={cand.name}
                      regNo={cand.regNo}
                      yearChip={cand.year ? <Chip>{cand.year}</Chip> : null}
                      paymentPill={
                        <Pill
                          track="paymentIv"
                          state={deriveInterviewerPayment(cand)}
                          size="sm"
                        />
                      }
                      onClick={() => onSelect(cand)}
                    />
                  </div>
                ))}
              </div>
              {!showAll && results.length > FIRST_PAGE ? (
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setShowAll(true)}
                >
                  Show all {results.length}
                </Button>
              ) : null}
            </>
          ) : (
            <EmptyState
              title={`No candidate matches “${q}”`}
              body="Check the reg number spelling, or:"
              action={
                <Button variant="secondary" size="md" onClick={onAddWalkIn}>
                  Add walk-in
                </Button>
              }
            />
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="iv-search__walkin-link"
        onClick={onAddWalkIn}
      >
        Candidate not registered? Add walk-in
      </button>
      </div>

      {/* My recent, >= 900px: the collapsible right panel on the stage
          canvas (display-gated by CSS — phones never see it). Fixed like
          the ambient layer; rows stay the same paper cards. Collapsed, a
          slim vertical reopen tab holds the right edge; the visibility
          swap keeps the off-stage half out of the tab order without
          unmounting (the slide still plays). */}
      {recents.length > 0 ? (
        <aside
          className={
            "iv-search__side" +
            (sideCollapsed ? " iv-search__side--collapsed" : "")
          }
          aria-label="My recent"
        >
          <div className="iv-search__side-panel">
            <div className="iv-search__side-head">
              <h2 className="iv-search__micro-label">My recent</h2>
              <span className="iv-search__side-tools">
                <button
                  type="button"
                  className="iv-search__clear-btn"
                  onClick={onClearRecents}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="iv-search__side-collapse"
                  aria-label="Hide my recent"
                  aria-expanded={!sideCollapsed}
                  onClick={() => setSidebar(true)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3.5 11 8l-5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </span>
            </div>
            <div className="iv-search__recent-list">
              {recents.map((cand) => (
                <RecentRow
                  key={cand.regNo}
                  cand={cand}
                  onOpen={onSelectRecent || onSelect}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="iv-search__side-tab"
            aria-label="Show my recent"
            aria-expanded={!sideCollapsed}
            onClick={() => setSidebar(false)}
          >
            <span className="iv-search__side-tab-pill">My recent</span>
          </button>
        </aside>
      ) : null}
    </div>
  );
}
