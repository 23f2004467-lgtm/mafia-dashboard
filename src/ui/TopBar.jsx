import React from "react";
import "./TopBar.css";

/**
 * TopBar — global chrome layout shell (§6 interviewer, §7.2 admin).
 * Pure layout: slots only, no business logic.
 *
 * Interviewer (48px): text wordmark "MAFIA" left, OR (when `onBack` is
 * provided) a back chevron + condensed-ticket slot (`left`).
 * Admin (56px): 2px six-segment spectrum hairline as the top border;
 * caller supplies the lockup/label via `left`.
 * `right` slot: connection dot / pending chip / avatar / export / user chip.
 * `children`: optional flexible center content.
 */
export default function TopBar({
  variant = "interviewer",
  stage = false,
  onBack,
  backLabel = "Back",
  left,
  right,
  children,
}) {
  const isAdmin = variant === "admin";

  let leftContent;
  if (onBack) {
    leftContent = (
      <>
        <button
          type="button"
          className="ui-topbar__back"
          onClick={onBack}
          aria-label={backLabel}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12.5 4.5 7 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {left ? <div className="ui-topbar__ticket-slot">{left}</div> : null}
      </>
    );
  } else if (left) {
    leftContent = left;
  } else if (!isAdmin) {
    leftContent = <span className="ui-topbar__wordmark">MAFIA</span>;
  } else {
    leftContent = null;
  }

  return (
    <header
      className={
        `ui-topbar ui-topbar--${variant}` + (stage ? " ui-topbar--stage" : "")
      }
    >
      {isAdmin ? (
        <div className="ui-topbar__hairline" aria-hidden="true">
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--red" />
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--orange" />
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--amber" />
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--green" />
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--blue" />
          <span className="ui-topbar__hairline-seg ui-topbar__hairline-seg--violet" />
        </div>
      ) : null}
      <div className="ui-topbar__row">
        <div className="ui-topbar__left">{leftContent}</div>
        {children ? (
          <div className="ui-topbar__center">{children}</div>
        ) : (
          <div className="ui-topbar__spacer" />
        )}
        {right ? <div className="ui-topbar__right">{right}</div> : null}
      </div>
    </header>
  );
}
