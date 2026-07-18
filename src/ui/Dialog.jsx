import React, { useEffect, useId, useRef, useState } from "react";
import useFocusTrap from "./useFocusTrap";
import "./Dialog.css";

/**
 * Dialog — centered overlay (§8, §7.8 danger zone).
 *
 * Enter: scale 0.98 → 1 + fade, 240ms --ease-spring; exit --ease.
 * `danger` renders role="alertdialog" (§10) and error-ink title.
 * `busy` holds it open until the async op resolves (fixes the
 * Modal.jsx:290-293 auto-close bug). `typedConfirm={{ word }}` renders the
 * mono confirm input; pass children as a function to receive
 * `{ confirmEnabled }` for the confirm button's disabled state.
 */
const EXIT_MS = 240;

export default function Dialog({
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
    "ui-dialog",
    phase === "open" ? "ui-dialog--open" : null,
    danger ? "ui-dialog--danger" : null,
    busy ? "ui-dialog--busy" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} onClick={handleScrimClick}>
      <div
        ref={panelRef}
        className="ui-dialog__panel"
        role={danger ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <div className="ui-dialog__header">
          {title ? (
            <h2 id={titleId} className="ui-dialog__title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="ui-dialog__close"
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
        <div className="ui-dialog__body">{body}</div>
        {typedConfirm ? (
          <div className="ui-dialog__typed">
            <label className="ui-dialog__typed-label" htmlFor={typedId}>
              Type <span className="ui-dialog__typed-word">{typedConfirm.word}</span> to confirm
            </label>
            <input
              id={typedId}
              className="ui-dialog__typed-input"
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
