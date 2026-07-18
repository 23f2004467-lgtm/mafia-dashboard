// src/undoGuard.js — the §2 #12 undo stale-check, extracted as a PURE
// predicate so it can be Jest-tested without Firebase (required by §14
// Phase 3).
//
// Undo re-issues the captured pre-write doc snapshot through the same write
// path, but ONLY when the doc is still exactly as our own write left it.
// `capturedMeta` is the {lastUpdatedAt, lastUpdatedBy} stamped by the write
// being undone; `freshMeta` is the same pair from a fresh read taken at
// undo time. Any mismatch (or a missing/deleted doc) means another user
// wrote in between — undo must abort with the "Changed by {name} just now —
// not undone." toast instead of resurrecting stale data.

export function canUndo(capturedMeta, freshMeta) {
  if (!capturedMeta || !freshMeta) return false;
  return (
    freshMeta.lastUpdatedAt === capturedMeta.lastUpdatedAt &&
    freshMeta.lastUpdatedBy === capturedMeta.lastUpdatedBy
  );
}
