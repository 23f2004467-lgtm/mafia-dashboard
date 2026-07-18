import React from "react";
import "./Skeleton.css";

/**
 * Skeleton — loading placeholder. shape: "text" | "row" | "tile".
 * Uses the existing skeleton-pulse keyframe from base.css.
 */
export default function Skeleton({ shape = "text" }) {
  return <span className={`ui-skeleton ui-skeleton--${shape}`} aria-hidden="true" />;
}
