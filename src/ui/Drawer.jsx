import React, { useEffect, useId, useRef, useState } from "react";
import useFocusTrap from "./useFocusTrap";
import "./Drawer.css";

/**
 * Drawer — right-side panel, 420px (§8, §7.5); full-screen overlay ≤ 1024px.
 *
 * Enter: translateX 240ms --ease-spring; exit: --ease. Same ported Modal
 * behaviors as Sheet (Esc / backdrop / scroll-lock / aria) + new focus
 * trap/restore. `busy` holds it open; `typedConfirm={{ word }}` as in Sheet
 * (children-as-function receives `{ confirmEnabled }`).
 */
const EXIT_MS = 240;

export default function Drawer({
  open = false,
  onClose,
  title,
  danger = false,
  busy = false,
  typedConfirm = null,
  children,
  className,
}) {
  const [phase, setPhase] = useState(open ? "enter" : "closed");
  const [typedValue, setTypedValue] = useState("");
  const panelRef = useRef(null);
  const titleId = useId();
  const typedId = useId();

  const guardedClose = () => {
    if (busy) return;
    if (onClose) onClose();
  };

  useEffect(() => {
    if (open) {
      setTypedValue("");
      setPhase("enter");
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase("open"));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setPhase((p) => (p === "closed" ? "closed" : "exit"));
    const t = setTimeout(() => setPhase("closed"), EXIT_MS + 60);
    return () => clearTimeout(t);
  }, [open]);

  const mounted = phase !== "closed";
  useEffect(() => {
    if (!mounted) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  useFocusTrap(panelRef, open && mounted, { onEscape: guardedClose });

  if (!mounted) return null;

  const handleScrimClick = (e) => {
    if (e.target === e.currentTarget) guardedClose();
  };

  const confirmEnabled = typedConfirm ? typedValue === typedConfirm.word : true;
  const body =
    typeof children === "function" ? children({ confirmEnabled }) : children;

  const rootClasses = [
    "ui-drawer",
    phase === "open" ? "ui-drawer--open" : null,
    danger ? "ui-drawer--danger" : null,
    busy ? "ui-drawer--busy" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} onClick={handleScrimClick}>
      <div
        ref={panelRef}
        className="ui-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <div className="ui-drawer__header">
          {title ? (
            <h2 id={titleId} className="ui-drawer__title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="ui-drawer__close"
            onClick={guardedClose}
            disabled={busy}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="ui-drawer__body">{body}</div>
        {typedConfirm ? (
          <div className="ui-drawer__typed">
            <label className="ui-drawer__typed-label" htmlFor={typedId}>
              Type <span className="ui-drawer__typed-word">{typedConfirm.word}</span> to confirm
            </label>
            <input
              id={typedId}
              className="ui-drawer__typed-input"
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
