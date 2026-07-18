import React, { useEffect, useId, useRef, useState } from "react";
import useFocusTrap from "./useFocusTrap";
import "./Sheet.css";

/**
 * Sheet — mobile bottom sheet (§8).
 *
 * Enter: translateY 240ms --ease-spring; exit: --ease. Scrim, safe-area
 * padded. Esc / backdrop-close / scroll-lock / aria ported from
 * common/Modal.jsx; focus trap + restore via useFocusTrap (new).
 *
 * - `busy` holds the sheet open: Esc, scrim taps and the close button are
 *   all ignored while busy (fixes the Modal.jsx:290-293 class of bug).
 * - `typedConfirm={{ word }}` renders a mono input that must exactly match
 *   the word to enable confirmation. The matched state reaches the caller
 *   by passing `children` as a function: `({ confirmEnabled }) => node`.
 */
const EXIT_MS = 240; // matches --motion-sheet; transitionend is primary, this is the fallback

export default function Sheet({
  open = false,
  onClose,
  title,
  danger = false,
  busy = false,
  typedConfirm = null,
  children,
  className,
}) {
  // Presence: 'closed' | 'enter' | 'open' | 'exit' — render while closing.
  const [phase, setPhase] = useState(open ? "enter" : "closed");
  const [typedValue, setTypedValue] = useState("");
  const panelRef = useRef(null);
  const titleId = useId();
  const typedId = useId();

  const guardedClose = () => {
    if (busy) return;
    if (onClose) onClose();
  };

  // Mount/unmount with the transition pattern.
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

  // Body scroll-lock, ported from Modal.jsx ~35-45 (held through the exit
  // transition so the page doesn't jump behind the closing sheet).
  const mounted = phase !== "closed";
  useEffect(() => {
    if (!mounted) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mounted]);

  // Focus trap + restore (new) + Esc (ported from Modal.jsx ~21-32).
  useFocusTrap(panelRef, open && mounted, { onEscape: guardedClose });

  if (!mounted) return null;

  // Backdrop close, ported from Modal.jsx ~74-78.
  const handleScrimClick = (e) => {
    if (e.target === e.currentTarget) guardedClose();
  };

  const confirmEnabled = typedConfirm ? typedValue === typedConfirm.word : true;
  const body =
    typeof children === "function" ? children({ confirmEnabled }) : children;

  const rootClasses = [
    "ui-sheet",
    phase === "open" ? "ui-sheet--open" : null,
    danger ? "ui-sheet--danger" : null,
    busy ? "ui-sheet--busy" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} onClick={handleScrimClick}>
      <div
        ref={panelRef}
        className="ui-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <div className="ui-sheet__grab" aria-hidden="true" />
        <div className="ui-sheet__header">
          {title ? (
            <h2 id={titleId} className="ui-sheet__title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="ui-sheet__close"
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
        <div className="ui-sheet__body">{body}</div>
        {typedConfirm ? (
          <div className="ui-sheet__typed">
            <label className="ui-sheet__typed-label" htmlFor={typedId}>
              Type <span className="ui-sheet__typed-word">{typedConfirm.word}</span> to confirm
            </label>
            <input
              id={typedId}
              className="ui-sheet__typed-input"
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
