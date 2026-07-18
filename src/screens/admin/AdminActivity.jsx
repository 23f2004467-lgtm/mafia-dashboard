import React, { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "../../ui";
import "./AdminActivity.css";

/**
 * AdminActivity (§7.7) — the live activity card. Presentational: `items`
 * are the last 15 candidate writes, derived CLIENT-SIDE in AdminPortal.jsx
 * from the existing candidates snapshot sorted by lastUpdatedAt (NO new
 * listeners). Line: "{name} · {verdict summary or 'updated'} · by
 * {lastUpdatedBy} · 40s ago" — mono age, ticking via a 1 s re-render.
 */

const SKELETON_ROWS = 5;

export default function AdminActivity({ items, ready = false, formatWhen }) {
  // 1 s tick keeps the mono ages honest between snapshots.
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  let body;
  if (!ready) {
    body = (
      <ol className="admin-act__list">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <li className="admin-act__row admin-act__row--skeleton" key={i}>
            <Skeleton shape="text" />
          </li>
        ))}
      </ol>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        title="No activity yet"
        body="Candidate writes appear here live."
      />
    );
  } else {
    body = (
      <ol className="admin-act__list">
        {items.map((it) => (
          <li className="admin-act__row" key={it.regNo}>
            <div className="admin-act__line">
              <span className="admin-act__name">{it.name}</span>
              <span className="admin-act__sep" aria-hidden="true">
                ·
              </span>
              <span className="admin-act__what" title={it.summary}>
                {it.summary}
              </span>
            </div>
            <div className="admin-act__meta">
              <span className="admin-act__by" title={it.by || undefined}>
                by {it.by || "—"}
              </span>
              <span className="admin-act__sep" aria-hidden="true">
                ·
              </span>
              <span className="admin-act__age">{formatWhen(it.at)}</span>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section className="admin-act" aria-label="Live activity">
      <header className="admin-act__head">
        <h2 className="admin-act__title">Live activity</h2>
        {ready && items.length > 0 ? (
          <span className="admin-act__meta-count">last {items.length}</span>
        ) : null}
      </header>
      {body}
    </section>
  );
}
