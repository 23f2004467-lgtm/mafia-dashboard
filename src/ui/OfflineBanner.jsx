import React from "react";
import "./OfflineBanner.css";

/**
 * OfflineBanner — thin amber connectivity banner (§6 global chrome).
 * Standalone (no Banner dependency) so it can render in any chrome.
 * role="status" announces the connectivity change politely.
 */
export default function OfflineBanner({
  message = "Offline — changes will sync",
}) {
  return (
    <div className="ui-offline-banner" role="status">
      <span className="ui-offline-banner__dot" aria-hidden="true" />
      <span className="ui-offline-banner__text">{message}</span>
    </div>
  );
}
