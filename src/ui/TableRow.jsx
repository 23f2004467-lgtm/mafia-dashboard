import React from "react";
import "./TableRow.css";

/**
 * TableRow — admin 44px table row (§7.4, §8, §10).
 * Generic cells via children (caller passes <td> elements).
 * When `onOpen` is provided the row is tabbable and Enter (or Space,
 * on the row itself) opens it; row click opens it too. Interactive
 * elements INSIDE cells must stopPropagation on their own clicks.
 * `flash` drives the flash-success overlay (120ms in / 800ms out).
 */
export default function TableRow({
  children,
  onOpen,
  flash = false,
  selected = false,
  openLabel,
}) {
  const interactive = typeof onOpen === "function";

  const handleKeyDown = (event) => {
    if (!interactive) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(event);
    }
  };

  const handleClick = (event) => {
    if (!interactive || event.defaultPrevented) return;
    onOpen(event);
  };

  const className =
    "ui-table-row" +
    (interactive ? " ui-table-row--interactive" : "") +
    (flash ? " ui-table-row--flash" : "") +
    (selected ? " ui-table-row--selected" : "");

  return (
    <tr
      className={className}
      tabIndex={interactive ? 0 : undefined}
      aria-label={openLabel}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onClick={interactive ? handleClick : undefined}
    >
      {children}
    </tr>
  );
}
