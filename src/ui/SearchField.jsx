import React from "react";
import "./SearchField.css";

/**
 * SearchField — §8.
 * sizes: interviewer (56px) | admin (40px).
 * Clear ✕ button when value present; inline spinner when loading
 * (spinner takes the clear button's slot); autoFocus passthrough; onClear.
 * onChange receives the native change event (standard controlled input).
 */
export default function SearchField({
  value,
  onChange,
  placeholder = "Search",
  size = "interviewer",
  loading = false,
  onClear,
  autoFocus = false,
  id,
  className,
  ...rest
}) {
  const classes = [
    "ui-searchfield",
    `ui-searchfield--${size}`,
    loading ? "ui-searchfield--loading" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const showClear = !loading && Boolean(value) && Boolean(onClear);

  return (
    <div className={classes}>
      <svg
        className="ui-searchfield__icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="9" cy="9" r="6" />
        <path d="M13.5 13.5 18 18" />
      </svg>
      <input
        id={id}
        className="ui-searchfield__input"
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        enterKeyHint="search"
        {...rest}
      />
      {loading ? (
        <span className="ui-searchfield__spinner" aria-hidden="true" />
      ) : null}
      {showClear ? (
        <button
          type="button"
          className="ui-searchfield__clear"
          aria-label="Clear search"
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
