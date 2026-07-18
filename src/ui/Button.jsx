import React from "react";
import "./Button.css";

/**
 * Button — §8.
 * variants: primary | secondary | ghost | destructive
 * sizes: lg (56, interviewer primary) | md (48) | sm (44, admin)
 * loading: spinner replaces label, width locked (label kept in flow, hidden).
 * disabled + disabledReason: visible reason subtext inside the button.
 * destructive (boolean): recolors the current variant destructively
 *   (e.g. ghost + destructive = the §6.4 ghost-destructive "Cancel payment").
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  disabledReason,
  destructive = false,
  onClick,
  type = "button",
  fullWidth = false,
  children,
  className,
  ...rest
}) {
  const isDisabled = disabled || loading;
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    destructive || variant === "destructive" ? "ui-button--destructive" : null,
    fullWidth ? "ui-button--full" : null,
    loading ? "ui-button--loading" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      <span className="ui-button__label">{children}</span>
      {disabled && !loading && disabledReason ? (
        <span className="ui-button__reason">{disabledReason}</span>
      ) : null}
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
    </button>
  );
}
