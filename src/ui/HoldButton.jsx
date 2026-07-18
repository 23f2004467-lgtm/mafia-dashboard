import React, { useCallback, useEffect, useRef, useState } from "react";
import "./HoldButton.css";

/**
 * HoldButton — §8 / §9.13. Money-touch only.
 * 600 ms radial fill (masked circle via transform: scale on an inner span —
 * CSS transition, no keyframes); early release springs back in 100 ms;
 * completion = 60 ms scale pulse + color flip. The JS timer is the safety
 * gate — onConfirm fires only after the full hold.
 * Pointer (pointerdown/up) AND keyboard (Space keydown/keyup) accessible.
 * variants: brand (default) | destructive.
 */
export default function HoldButton({
  label,
  onConfirm,
  holdMs = 600,
  variant = "brand",
}) {
  const [holding, setHolding] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | pulse | confirmed
  const holdTimer = useRef(null);
  const pulseTimer = useRef(null);
  const confirmedRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const start = useCallback(() => {
    if (confirmedRef.current || holdTimer.current) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      confirmedRef.current = true;
      setHolding(false);
      setPhase("pulse");
      pulseTimer.current = setTimeout(() => setPhase("confirmed"), 60);
      if (onConfirm) onConfirm();
    }, holdMs);
  }, [holdMs, onConfirm]);

  const cancel = useCallback(() => {
    if (confirmedRef.current) return;
    clearHoldTimer();
    setHolding(false);
  }, []);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    []
  );

  const handlePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start();
  };

  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault(); // suppress the native click on keyup
      if (!e.repeat) start();
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      cancel();
    }
  };

  const classes = [
    "ui-holdbutton",
    `ui-holdbutton--${variant}`,
    holding ? "ui-holdbutton--holding" : null,
    phase === "pulse" ? "ui-holdbutton--pulse" : null,
    phase === "confirmed" ? "ui-holdbutton--confirmed" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      style={{ "--ui-hold-ms": `${holdMs}ms` }}
      onPointerDown={handlePointerDown}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="ui-holdbutton__fill" aria-hidden="true" />
      <span className="ui-holdbutton__label">{label}</span>
    </button>
  );
}
