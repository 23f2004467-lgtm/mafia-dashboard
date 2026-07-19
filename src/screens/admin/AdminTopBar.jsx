import React, { useEffect, useRef, useState } from "react";
import { Avatar, Button, TopBar } from "../../ui";
import "./AdminTopBar.css";

/**
 * AdminTopBar (§7.2) — composes the ui/ TopBar admin variant (which owns
 * the six-segment spectrum hairline). Presentational: every handler and
 * timestamp comes from AdminPortal.jsx.
 *
 * - lockup 20px + "ADMIN" micro-label
 * - live sync pill: green dot + "Synced 3s ago" (mono tabular), ticking
 *   every 1 s off the latest candidates-snapshot receipt timestamp
 * - Export Button (§2 #27): no filters active → onExport("all") directly;
 *   filters active → scope popover "Export {M} filtered" / "Export all {N}".
 *   `exportBusy` shows the width-locked progress spinner on the button.
 * - overflow "⋯" menu: Check-in desk… (desk feature 2026-07-20: the
 *   allowlist Dialog in AdminPortal.jsx) · Import time slots… (stage B
 *   2026-07-20: the slot-sheet import Dialog in AdminPortal.jsx) · Force
 *   logout all… · Danger zone… (§7.8: amber Reset / red Delete, each
 *   opening its typed-confirm Dialog in AdminPortal.jsx) · Sign out
 * - user chip: Avatar initials + email
 */
export default function AdminTopBar({
  lastSyncAt,
  onExport,
  exportBusy = false,
  filtersActive = false,
  totalCount = 0,
  filteredCount = 0,
  onManageDesk,
  onImportSlots,
  onForceLogout,
  onDangerReset,
  onDangerDelete,
  onSignOut,
  userEmail,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const menuRef = useRef(null);

  // §2 #27 export scope popover (only reachable when filters are active).
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  // 1 s tick drives the "Synced Ns ago" pill.
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Outside click + Esc close the overflow menu.
  useEffect(() => {
    if (!menuOpen) {
      setDangerOpen(false);
      return undefined;
    }
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Outside click + Esc close the export scope popover.
  useEffect(() => {
    if (!exportOpen) return undefined;
    const onDown = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportOpen]);

  const pick = (fn) => () => {
    setMenuOpen(false);
    if (fn) fn();
  };

  const handleExportClick = () => {
    if (exportBusy) return;
    if (filtersActive) {
      setExportOpen((o) => !o);
    } else {
      onExport("all");
    }
  };

  const pickScope = (scope) => () => {
    setExportOpen(false);
    onExport(scope);
  };

  let syncLabel;
  let waiting = false;
  if (lastSyncAt) {
    const s = Math.max(0, Math.floor((Date.now() - lastSyncAt.getTime()) / 1000));
    syncLabel = s < 60 ? `Synced ${s}s ago` : `Synced ${Math.floor(s / 60)}m ago`;
  } else {
    syncLabel = "Waiting for data…";
    waiting = true;
  }

  return (
    <TopBar
      variant="admin"
      left={
        <>
          <img
            className="admin-topbar__lockup"
            src="/brand/wordmark-white.png"
            alt="MAFIA"
          />
          <span className="admin-topbar__microlabel">Admin</span>
        </>
      }
      right={
        <>
          <span
            className={
              "admin-sync" + (waiting ? " admin-sync--waiting" : "")
            }
            role="status"
          >
            <span className="admin-sync__dot" aria-hidden="true" />
            <span className="admin-sync__label">{syncLabel}</span>
          </span>
          <span className="admin-topbar__menuwrap" ref={exportRef}>
            <Button
              size="sm"
              variant="secondary"
              loading={exportBusy}
              onClick={handleExportClick}
              aria-haspopup={filtersActive ? "menu" : undefined}
              aria-expanded={filtersActive ? exportOpen : undefined}
            >
              Export
            </Button>
            {exportOpen ? (
              <div
                className="admin-menu admin-export-menu"
                role="menu"
                aria-label="Export scope"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item"
                  onClick={pickScope("filtered")}
                >
                  Export{" "}
                  <span className="admin-menu__count">{filteredCount}</span>{" "}
                  filtered
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item"
                  onClick={pickScope("all")}
                >
                  Export all{" "}
                  <span className="admin-menu__count">{totalCount}</span>
                </button>
              </div>
            ) : null}
          </span>
          <span className="admin-topbar__menuwrap" ref={menuRef}>
            <button
              type="button"
              className="admin-topbar__more"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="admin-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item"
                  onClick={pick(onManageDesk)}
                >
                  Check-in desk…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item"
                  onClick={pick(onImportSlots)}
                >
                  Import time slots…
                </button>
                <div className="admin-menu__divider" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item admin-menu__item--destructive"
                  onClick={pick(onForceLogout)}
                >
                  Force logout all…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item admin-menu__item--destructive"
                  aria-expanded={dangerOpen}
                  onClick={() => setDangerOpen((o) => !o)}
                >
                  Danger zone…
                </button>
                {dangerOpen ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-menu__item admin-menu__item--warn admin-menu__item--sub"
                      onClick={pick(onDangerReset)}
                    >
                      Reset interview data…
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-menu__item admin-menu__item--destructive admin-menu__item--sub"
                      onClick={pick(onDangerDelete)}
                    >
                      Delete ALL candidate data…
                    </button>
                  </>
                ) : null}
                <div className="admin-menu__divider" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  className="admin-menu__item"
                  onClick={pick(onSignOut)}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </span>
          <span className="admin-topbar__user">
            <Avatar name={userEmail} size={32} />
            <span className="admin-topbar__email">{userEmail}</span>
          </span>
        </>
      }
    />
  );
}
