import React from "react";
import "./Avatar.css";

/**
 * Avatar — initials disc. Sizes 32 (default) / 40.
 * Initials: first letter of the first two words of `name`, uppercased;
 * "?" when no name is available.
 */
function getInitials(name) {
  if (!name) return "?";
  const words = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Avatar({ name, size = 32 }) {
  return (
    <span
      className={`ui-avatar ui-avatar--${size === 40 ? "40" : "32"}`}
      role="img"
      aria-label={name || "Unknown user"}
    >
      {getInitials(name)}
    </span>
  );
}
