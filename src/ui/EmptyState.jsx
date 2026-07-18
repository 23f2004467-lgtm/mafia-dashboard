import React from "react";
import "./EmptyState.css";

/**
 * EmptyState — title, body, and AT MOST one action. No illustrations.
 */
export default function EmptyState({ title, body, action }) {
  return (
    <div className="ui-empty-state">
      <h3 className="ui-empty-state__title">{title}</h3>
      {body ? <p className="ui-empty-state__body">{body}</p> : null}
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </div>
  );
}
