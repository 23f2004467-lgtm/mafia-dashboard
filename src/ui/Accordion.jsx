import React, { useId, useState } from "react";
import "./Accordion.css";

/**
 * Accordion — collapsed 44 px header + chevron (§6.3 Zone C, questions).
 *
 * Open/close approach (reported per the build brief): height animation is
 * banned, so the panel stays mounted inside a CSS grid whose
 * grid-template-rows flips 0fr → 1fr WITHOUT a transition (the height
 * change is instant) while the inner content fades in with a 120 ms
 * opacity transition — i.e. "instant show with opacity fade", fully
 * compliant with the transform/opacity-only motion law and using zero
 * new keyframes. Closed content is visibility:hidden (out of tab order).
 */
export default function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;

  return (
    <div className={`ui-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        id={headerId}
        className="ui-accordion__header"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ui-accordion__title">{title}</span>
        <svg
          className="ui-accordion__chevron"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={panelId}
        className="ui-accordion__panel"
        role="region"
        aria-labelledby={headerId}
      >
        <div className="ui-accordion__panel-inner">
          <div className="ui-accordion__content">{children}</div>
        </div>
      </div>
    </div>
  );
}
