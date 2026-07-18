import React, { useEffect, useState } from "react";
import "./QRPanel.css";

/**
 * QRPanel — the payment QR surface (§6.4, §8, §9.5, §9.11).
 * Presentational only: the actual <QRCode> element is passed as children
 * (this component never imports react-qr-code).
 *
 * Props:
 *   value      — UPI ID string; rendered as selectable mono text (§10)
 *   code       — verification code; rendered chunked ("K7F · 2Q9"), display-only
 *   status     — "generating" | "active" | "timeout" | "error" | "receipt"
 *   lastChecked — pre-formatted ticking string (e.g. "0:12"); shown when active
 *   triesLeft  — number; shown in timeout/error states
 *   banner     — status Banner slot (caller passes a <Banner>)
 *   children   — the QR element (caller-owned)
 */

function chunkCode(code) {
  const raw = String(code == null ? "" : code).trim();
  if (!raw) return "";
  return (raw.match(/.{1,3}/g) || []).join(" · ");
}

export default function QRPanel({
  value,
  code,
  status = "generating",
  lastChecked,
  triesLeft,
  banner,
  children,
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  let qrContent;
  if (status === "generating") {
    qrContent = (
      <div
        className="ui-qr-panel__arc"
        role="status"
        aria-label="Generating QR"
      />
    );
  } else if (status === "receipt") {
    qrContent = (
      <div className="ui-qr-panel__receipt-mark" aria-hidden="true">
        ✓
      </div>
    );
  } else {
    qrContent = (
      <div
        className={
          "ui-qr-panel__qr-content" +
          (children ? " ui-qr-panel__qr-content--ready" : "")
        }
      >
        {children}
      </div>
    );
  }

  return (
    <section
      className={"ui-qr-panel" + (entered ? " ui-qr-panel--in" : "")}
      data-status={status}
    >
      <div className="ui-qr-panel__qr">{qrContent}</div>
      {code ? (
        <div className="ui-qr-panel__code-well">
          <span
            className="ui-qr-panel__code"
            aria-label={"Verification code " + String(code)}
          >
            {chunkCode(code)}
          </span>
        </div>
      ) : null}
      {value ? (
        <p className="ui-qr-panel__value">
          UPI <span className="ui-qr-panel__value-mono">{value}</span>
        </p>
      ) : null}
      {banner ? <div className="ui-qr-panel__banner">{banner}</div> : null}
      {status === "active" && lastChecked ? (
        <p className="ui-qr-panel__meta">
          last checked <span className="tnum">{lastChecked}</span>
        </p>
      ) : null}
      {(status === "timeout" || status === "error") && triesLeft != null ? (
        <p className="ui-qr-panel__meta">
          <span className="tnum">{triesLeft}</span>{" "}
          {triesLeft === 1 ? "try" : "tries"} left
        </p>
      ) : null}
    </section>
  );
}
