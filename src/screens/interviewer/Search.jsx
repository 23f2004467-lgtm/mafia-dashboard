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
import { deriveJourneyState as deriveJourneyStateShared } from "../../candidateState";
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
 *   mafia.recentCandidates localStorage key), compact rows with pills.
 * - Autofocus only when arriving via "Next candidate" (§2 #45).
 */

/** §5 Track 2 — payment pill state from existing paid/manuallyVerified. */
const derivePaymentState = (cand) =>
  cand && cand.paid
    ? cand.manuallyVerified
      ? "verified"
      : "paid_unverified"
    : "unpaid";

/** §5 Track 1 — the single source of truth (src/candidateState.js): prefers
 *  the Phase-7 verdictStatus when present, falls back to the exact pre-Phase-7
 *  array derivation on old docs; missing fields always render permissive
 *  (landmine #11). */
const deriveJourneyState = deriveJourneyStateShared;

const FIRST_PAGE = 20;
const STAGGER_ROWS = 8; // §9.2: first 8 rows stagger, later rows instant

export default function Search({
  query,
  onQueryChange,
  results,
  loading = false,
  draft = null,
  onResumeDraft,
  onDiscardDraft,
  recents = [],
  onSelect,
  onSelectRecent,
  onAddWalkIn,
  autoFocus = false,
}) {
  const q = query.trim();
  const active = q.length >= 2;

  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [q]);

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
        <img
          className="iv-search__ambient-hero"
          src="/brand/ambient-emb-1.png"
          alt=""
          draggable={false}
        />
        <img
          className="iv-search__ambient-hero-dark"
          src="/brand/ambient-emb-1-dark.png"
          alt=""
          draggable={false}
        />
        <img
          className="iv-search__ambient-side-dark"
          src="/brand/ambient-emb-2-dark.png"
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

      {!active && recents.length > 0 ? (
        <section className="iv-search__recent" aria-label="My recent">
          <h2 className="iv-search__micro-label">My recent</h2>
          <div className="iv-search__recent-list">
            {recents.map((cand) => (
              <button
                key={cand.regNo}
                type="button"
                className="iv-search__recent-row"
                onClick={() => (onSelectRecent || onSelect)(cand)}
              >
                <span className="iv-search__recent-main">
                  <span className="iv-search__recent-name">{cand.name}</span>
                  <span className="iv-search__recent-regno">
                    {formatRegNo(cand.regNo)}
                  </span>
                </span>
                <span className="iv-search__recent-pills">
                  <Pill
                    track="journey"
                    state={deriveJourneyState(cand)}
                    size="sm"
                  />
                  <Pill
                    track="payment"
                    state={derivePaymentState(cand)}
                    size="sm"
                  />
                </span>
              </button>
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
                          track="payment"
                          state={derivePaymentState(cand)}
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
    </div>
  );
}
