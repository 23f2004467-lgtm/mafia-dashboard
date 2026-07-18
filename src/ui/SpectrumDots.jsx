import React from "react";
import "./SpectrumDots.css";

/**
 * SpectrumDots — the six canonical dots (§2 #50, §9.4).
 * Static lockup form (decorative, aria-hidden) and loader form
 * (`loading`, role="status", spectrum-seq keyframe with per-dot delay —
 * a §9 named loop: 1.2s cycle, red → violet).
 * Sizes: 6 | 8 | 10 (px). Violet renders --brand-400 on dark grounds
 * via the [data-theme="dark"] override in CSS.
 */

const ORDER = ["red", "orange", "amber", "green", "blue", "violet"];

export default function SpectrumDots({
  size = 8,
  loading = false,
  label = "Loading",
}) {
  const px = size === 6 || size === 8 || size === 10 ? size : 8;
  return (
    <div
      className={
        "ui-spectrum-dots ui-spectrum-dots--" +
        px +
        (loading ? " ui-spectrum-dots--loading" : "")
      }
      role={loading ? "status" : undefined}
      aria-label={loading ? label : undefined}
      aria-hidden={loading ? undefined : "true"}
    >
      {ORDER.map((color) => (
        <span
          key={color}
          className={
            "ui-spectrum-dots__dot ui-spectrum-dots__dot--" + color
          }
        />
      ))}
    </div>
  );
}
