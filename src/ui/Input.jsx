import React, { useId } from "react";
import "./Input.css";

/**
 * Input / Select / Textarea — §8. One file, three exports (default = Input).
 * label is REQUIRED and renders as a real <label htmlFor>.
 * error: 13px message, wired via aria-describedby + role="alert".
 * helper: 13px helper text (hidden while an error is showing).
 * mono: switches the control to var(--font-mono).
 * readOnly: borderless sunken well.
 * 16px font minimum (iOS-zoom floor).
 */

function fieldClasses(kind, { mono, readOnly, error, className }) {
  return [
    "ui-field",
    `ui-field--${kind}`,
    mono ? "ui-field--mono" : null,
    readOnly ? "ui-field--readonly" : null,
    error ? "ui-field--error" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function useFieldIds(id, error, helper) {
  const autoId = useId();
  const controlId = id || autoId;
  const errorId = `${controlId}-error`;
  const helperId = `${controlId}-helper`;
  const describedBy =
    [error ? errorId : null, helper && !error ? helperId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return { controlId, errorId, helperId, describedBy };
}

function FieldText({ error, helper, errorId, helperId }) {
  return (
    <>
      {helper && !error ? (
        <div className="ui-field__helper" id={helperId}>
          {helper}
        </div>
      ) : null}
      {error ? (
        <div className="ui-field__error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

export function Input({
  label,
  error,
  helper,
  mono = false,
  readOnly = false,
  inputMode,
  id,
  type = "text",
  className,
  ...rest
}) {
  const { controlId, errorId, helperId, describedBy } = useFieldIds(id, error, helper);
  return (
    <div className={fieldClasses("input", { mono, readOnly, error, className })}>
      <label className="ui-field__label" htmlFor={controlId}>
        {label}
      </label>
      <input
        id={controlId}
        className="ui-field__control"
        type={type}
        inputMode={inputMode}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldText error={error} helper={helper} errorId={errorId} helperId={helperId} />
    </div>
  );
}

export function Select({
  label,
  error,
  helper,
  mono = false,
  readOnly = false,
  id,
  className,
  children,
  ...rest
}) {
  const { controlId, errorId, helperId, describedBy } = useFieldIds(id, error, helper);
  return (
    <div className={fieldClasses("select", { mono, readOnly, error, className })}>
      <label className="ui-field__label" htmlFor={controlId}>
        {label}
      </label>
      <span className="ui-field__selectwrap">
        <select
          id={controlId}
          className="ui-field__control ui-field__control--select"
          disabled={readOnly || rest.disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
      </span>
      <FieldText error={error} helper={helper} errorId={errorId} helperId={helperId} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  helper,
  mono = false,
  readOnly = false,
  inputMode,
  rows = 4,
  id,
  className,
  ...rest
}) {
  const { controlId, errorId, helperId, describedBy } = useFieldIds(id, error, helper);
  return (
    <div className={fieldClasses("textarea", { mono, readOnly, error, className })}>
      <label className="ui-field__label" htmlFor={controlId}>
        {label}
      </label>
      <textarea
        id={controlId}
        className="ui-field__control ui-field__control--textarea"
        rows={rows}
        inputMode={inputMode}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <FieldText error={error} helper={helper} errorId={errorId} helperId={helperId} />
    </div>
  );
}

export default Input;
