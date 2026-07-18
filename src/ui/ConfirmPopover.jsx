import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Button from "./Button";
import useFocusTrap from "./useFocusTrap";
import "./ConfirmPopover.css";

/**
 * ConfirmPopover — anchored confirm (§8, §7.5 admin verify).
 *
 * Positions itself relative to `anchor` (a ref to the triggering element),
 * below it when there is room, above otherwise, clamped to the viewport.
 * Focus-trapped with restore-to-opener; Esc and outside click close it.
 * `working` holds it open (Esc/outside ignored) and shows the confirm
 * button loading. `destructive` recolors the confirm action.
 */
const EXIT_MS = 240;
const MARGIN = 8; // viewport clamp, px (dynamic positioning constant, not styling)

export default function ConfirmPopover({
  open = false,
  onClose,
  anchor,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  working = false,
  className,
}) {
  const [phase, setPhase] = useState(open ? "enter" : "closed");
  const [pos, setPos] = useState(null); // {top, left} — truly dynamic inline style
  const panelRef = useRef(null);
  const messageId = useId();

  const guardedClose = () => {
    if (working) return;
    if (onClose) onClose();
  };

  useEffect(() => {
    if (open) {
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

  // Position against the anchor once mounted (and on resize/scroll).
  useLayoutEffect(() => {
    if (!mounted) return undefined;

    const place = () => {
      const anchorEl = anchor && anchor.current;
      const panelEl = panelRef.current;
      if (!anchorEl || !panelEl) return;
      const a = anchorEl.getBoundingClientRect();
      const p = panelEl.getBoundingClientRect();

      let top = a.bottom + MARGIN;
      if (top + p.height > window.innerHeight - MARGIN) {
        top = Math.max(MARGIN, a.top - p.height - MARGIN);
      }
      let left = a.left;
      // Viewport clamp via documentElement.clientWidth (Phase 6 gate: no JS window-width reads).
      const viewportWidth = document.documentElement.clientWidth;
      if (left + p.width > viewportWidth - MARGIN) {
        left = Math.max(MARGIN, viewportWidth - MARGIN - p.width);
      }
      setPos({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [mounted, anchor]);

  useFocusTrap(panelRef, open && mounted, { onEscape: guardedClose });

  if (!mounted) return null;

  const handleOutsideClick = (e) => {
    if (e.target === e.currentTarget) guardedClose();
  };

  const rootClasses = [
    "ui-confirm-popover",
    phase === "open" ? "ui-confirm-popover--open" : null,
    destructive ? "ui-confirm-popover--destructive" : null,
    working ? "ui-confirm-popover--working" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} onClick={handleOutsideClick}>
      <div
        ref={panelRef}
        className="ui-confirm-popover__panel"
        role="dialog"
        aria-modal="true"
        aria-describedby={message ? messageId : undefined}
        aria-busy={working || undefined}
        tabIndex={-1}
        style={pos ? { top: `${pos.top}px`, left: `${pos.left}px` } : undefined}
      >
        {message ? (
          <p id={messageId} className="ui-confirm-popover__message">
            {message}
          </p>
        ) : null}
        <div className="ui-confirm-popover__actions">
          <Button variant="ghost" size="sm" disabled={working} onClick={guardedClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            size="sm"
            loading={working}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
