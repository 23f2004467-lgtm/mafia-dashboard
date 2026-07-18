import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  EmptyState,
  Pill,
  SearchField,
  Skeleton,
  TableRow,
  formatRegNo,
} from "../../ui";
import "./AdminCandidatesTable.css";

/**
 * AdminCandidatesTable (§7.4) — the workhorse card. Presentational: all
 * filtering/derivation happens in AdminPortal.jsx; this renders the rows
 * it is given.
 *
 * - Toolbar: SearchField 40px + filter Chips with live counts (no <select>).
 * - Columns: RegNo (mono, formatRegNo) · Name · Year · Verdict (display-only
 *   join of BOTH verdict arrays — landmine #10: write shape untouched) ·
 *   Payment Pill (§5) · Updated (who + mono relative when) · chevron.
 * - Windowing: first 100 rows + IntersectionObserver sentinel loads +100
 *   (hand-rolled, §7.4). Window resets when search/filter change.
 * - Loading: skeleton rows after a 150 ms grace (§9); "No candidates match
 *   your filters" only after the first snapshot; empty-filter state offers
 *   "Clear filters".
 * - `flashRegNo` drives the TableRow success flash (120 ms in / 800 ms out).
 * - Rows open the §7.5 drawer: click / Enter / Space via TableRow `onOpen`
 *   (`onOpenRow(candidate)`); `selectedRegNo` marks the open row. Verify
 *   lives in the drawer's confirm popover now — no in-row writes.
 */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid_unverified", label: "Paid · unverified" },
  { key: "verified", label: "Verified" },
  { key: "selected", label: "Selected" },
];

/** §6.3 Zone-D short labels; VALUES in the verdict arrays are the exact
 *  existing DB strings (display-only mapping, same as Done.jsx). */
const WORK_DOMAIN_LABELS = {
  "Human Resources": "HR",
  "Public Relations": "PR",
  "Social Media and Graphic Design": "SM&GD",
  "Photography and Videography": "P&V",
};

const PAGE = 100;
const COLUMNS = 7;
const SKELETON_ROWS = 8;

/** §5 Track 2 — payment pill state from existing paid/manuallyVerified. */
const paymentState = (c) =>
  c.paid ? (c.manuallyVerified ? "verified" : "paid_unverified") : "unpaid";

/** ALL selected domains joined from BOTH arrays (§7.4 — display only). */
const verdictDomains = (c) => {
  const talent = Array.isArray(c.verdict?.talentComm) ? c.verdict.talentComm : [];
  const work = Array.isArray(c.verdict?.workComm) ? c.verdict.workComm : [];
  return [...talent, ...work.map((d) => WORK_DOMAIN_LABELS[d] || d)];
};

export default function AdminCandidatesTable({
  rows,
  ready = false,
  search,
  onSearchChange,
  onClearSearch,
  filter,
  onFilterChange,
  counts,
  onClearFilters,
  flashRegNo,
  onOpenRow,
  selectedRegNo,
  scrollRef,
  filterKey,
  formatWhen,
}) {
  // 150 ms skeleton grace (§9 loading rules).
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraceOver(true), 150);
    return () => clearTimeout(t);
  }, []);

  // Hand-rolled windowing: first 100 rows, sentinel loads +100 (§7.4).
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => {
    setVisible(PAGE);
  }, [filterKey]);

  const hasMore = ready && rows.length > visible;
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => v + PAGE);
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, visible]);

  const filtersActive = Boolean(search) || filter !== "all";

  let body = null;
  if (!ready) {
    if (graceOver) {
      body = Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <tr className="admin-table__skeleton" key={`skeleton-${i}`}>
          {Array.from({ length: COLUMNS }, (_, j) => (
            <td key={j}>
              <Skeleton shape="text" />
            </td>
          ))}
        </tr>
      ));
    }
  } else {
    body = rows.slice(0, visible).map((c, i) => {
      const domains = verdictDomains(c);
      return (
        <TableRow
          key={c.regNo || i}
          flash={c.regNo === flashRegNo}
          selected={c.regNo === selectedRegNo}
          onOpen={() => onOpenRow(c)}
          openLabel={`Open ${c.name || c.regNo}`}
        >
          <td className="admin-table__regno">{formatRegNo(c.regNo)}</td>
          <td className="admin-table__name">{c.name}</td>
          <td className="admin-table__year">{c.year || "—"}</td>
          <td>
            {domains.length > 0 ? (
              <span
                className="admin-table__verdict-pill"
                title={domains.join(" + ")}
              >
                {domains.join(" + ")}
              </span>
            ) : (
              <span className="admin-table__muted">—</span>
            )}
          </td>
          <td>
            <Pill track="payment" state={paymentState(c)} />
          </td>
          <td className="admin-table__updated">
            {c.lastUpdatedBy ? (
              <>
                <span className="admin-table__updated-who">
                  {c.lastUpdatedBy}
                </span>
                {c.lastUpdatedAt ? (
                  <span className="admin-table__updated-when">
                    {formatWhen(c.lastUpdatedAt)}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="admin-table__muted">—</span>
            )}
          </td>
          <td className="admin-table__actions">
            <span className="admin-table__chevron" aria-hidden="true">
              ›
            </span>
          </td>
        </TableRow>
      );
    });
  }

  return (
    <section className="admin-table-card" ref={scrollRef}>
      <div className="admin-table-card__toolbar">
        <SearchField
          size="admin"
          value={search}
          onChange={onSearchChange}
          onClear={onClearSearch}
          placeholder="Search reg no or name…"
        />
        <div
          className="admin-table-card__chips"
          role="group"
          aria-label="Filter candidates by state"
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              selected={filter === f.key}
              count={counts ? counts[f.key] : undefined}
              onToggle={() => onFilterChange(f.key)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="admin-table-card__scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Reg no</th>
              <th scope="col">Name</th>
              <th scope="col">Year</th>
              <th scope="col">Verdict</th>
              <th scope="col">Payment</th>
              <th scope="col">Updated</th>
              <th scope="col" aria-label="Open" />
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>

        {ready && rows.length === 0 ? (
          filtersActive ? (
            <EmptyState
              title="No candidates match your filters"
              action={
                <Button size="sm" variant="secondary" onClick={onClearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No candidates yet"
              body="Candidates appear here as soon as they register."
            />
          )
        ) : null}
      </div>

      {hasMore ? (
        <div
          className="admin-table-card__sentinel"
          ref={sentinelRef}
          aria-hidden="true"
        />
      ) : null}
    </section>
  );
}
