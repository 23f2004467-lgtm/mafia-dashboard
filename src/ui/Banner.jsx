import React from "react";
import "./Banner.css";

/**
 * Banner — inline status/message strip (§8).
 * Tones: info · success · warning · error · payment-status · offline.
 * payment-status and offline carry role="status" (live regions);
 * error carries role="alert". Children are the (possibly ticking) content
 * slot; `action` is an optional action node; `dismissible` renders a ×
 * button wired to `onDismiss`.
 */
export default function Banner({
  tone = "info",
  children,
  action,
  dismissible = false,
  onDismiss,
}) {
  const role =
    tone === "error"
      ? "alert"
      : tone === "payment-status" || tone === "offline"
      ? "status"
      : undefined;

  return (
    <div className={`ui-banner ui-banner--${tone}`} role={role}>
      <div className="ui-banner__content">{children}</div>
      {action ? <div className="ui-banner__action">{action}</div> : null}
      {dismissible ? (
        <button
          type="button"
          className="ui-banner__dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
