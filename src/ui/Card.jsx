import React from "react";
import "./Card.css";

/**
 * Card — surface container. `sunken` renders the sunken-well variant.
 * `padding` accepts a CSS length (number = px) and is applied inline as a
 * truly dynamic value; default padding lives in CSS (--space-4).
 * Hover-lift (1 px translate) applies on desktop pointers only,
 * via @media (hover: hover) in CSS.
 */
export default function Card({
  as: As = "div",
  padding,
  sunken = false,
  className = "",
  children,
  ...rest
}) {
  const style =
    padding != null
      ? { padding: typeof padding === "number" ? `${padding}px` : padding }
      : undefined;
  return (
    <As
      className={`ui-card${sunken ? " ui-card--sunken" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={style}
      {...rest}
    >
      {children}
    </As>
  );
}
