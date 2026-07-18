import { useEffect, useRef } from "react";

/**
 * useFocusTrap — shared overlay focus management (§8, §10).
 *
 * Implements the two behaviors common/Modal.jsx never had:
 *   1. Focus trap: Tab / Shift-Tab cycle inside the container.
 *   2. Focus restore: the element focused before the overlay opened
 *      gets focus back when the trap deactivates (overlay closes).
 *
 * It also owns the Esc-to-close handling (ported from Modal.jsx ~21-32)
 * via `onEscape`, routed through a module-level overlay stack so that when
 * overlays nest (e.g. ConfirmPopover inside Drawer) only the TOP overlay
 * reacts to Esc and traps Tab.
 *
 * Usage:
 *   const panelRef = useRef(null);
 *   useFocusTrap(panelRef, open, { onEscape: handleEscape });
 *   // the container should have tabIndex={-1}
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Module-level stack of active overlays; last entry = topmost. */
const overlayStack = [];

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0
  );
}

export default function useFocusTrap(containerRef, active, options = {}) {
  const { onEscape } = options;

  // Keep the latest onEscape without re-running the effect (busy state
  // toggles change the callback identity every render).
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;

    const entry = { containerRef };
    overlayStack.push(entry);

    // Remember the opener to restore focus on close.
    const openerEl =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Initial focus: the container itself (tabIndex -1), so the first Tab
    // lands on the first control instead of auto-focusing a close button.
    const container = containerRef.current;
    if (container && typeof container.focus === "function") {
      container.focus();
    }

    const handleKeyDown = (e) => {
      // Only the topmost overlay handles keys.
      if (overlayStack[overlayStack.length - 1] !== entry) return;

      if (e.key === "Escape") {
        if (onEscapeRef.current) onEscapeRef.current(e);
        return;
      }

      if (e.key !== "Tab") return;

      const node = containerRef.current;
      if (!node) return;

      const items = getFocusable(node);
      const current = document.activeElement;

      if (items.length === 0) {
        // Nothing focusable: keep focus pinned on the container.
        e.preventDefault();
        if (typeof node.focus === "function") node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const inside = node.contains(current);

      if (e.shiftKey) {
        if (!inside || current === first || current === node) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const idx = overlayStack.indexOf(entry);
      if (idx !== -1) overlayStack.splice(idx, 1);
      // Focus restore — only if the opener is still in the document.
      if (openerEl && document.contains(openerEl)) {
        openerEl.focus();
      }
    };
  }, [active, containerRef]);
}
