// §5 candidate-state — the single source of truth for the Track-1 Journey
// derivation (Phase 7a). Guards the golden rule (landmine #11): missing
// additive fields ALWAYS render the permissive state; old docs behave exactly
// as pre-Phase-7. Pure module — no firebase, no App.js.
import {
  JOURNEY,
  hasAnyDomain,
  deriveJourneyState,
  deriveVerdictStatusForWrite,
  isCheckedIn,
  isWaiting,
  activatedAtMillis,
  compareByActivatedAt,
} from './candidateState';

describe('deriveJourneyState (§5 Track-1)', () => {
  it('prefers verdictStatus === "selected" when the field EXISTS', () => {
    // Field wins even if the arrays are empty (Phase-7 doc).
    expect(
      deriveJourneyState({
        verdictStatus: 'selected',
        verdict: { talentComm: [], workComm: [] },
      })
    ).toBe(JOURNEY.SELECTED);
  });

  it('prefers verdictStatus === "not_selected" when the field EXISTS', () => {
    expect(
      deriveJourneyState({
        verdictStatus: 'not_selected',
        verdict: { talentComm: [], workComm: [] },
      })
    ).toBe(JOURNEY.NOT_SELECTED);
  });

  it('falls back to non-empty verdict arrays → selected when verdictStatus is ABSENT (old doc)', () => {
    expect(
      deriveJourneyState({ verdict: { talentComm: ['Selected for Music'], workComm: [] } })
    ).toBe(JOURNEY.SELECTED);
    expect(
      deriveJourneyState({ verdict: { talentComm: [], workComm: ['Shortlisted for Design'] } })
    ).toBe(JOURNEY.SELECTED);
  });

  it('missing verdictStatus + EMPTY arrays → checked_in, NEVER not_selected (landmine #11)', () => {
    expect(
      deriveJourneyState({ verdict: { talentComm: [], workComm: [] } })
    ).toBe(JOURNEY.CHECKED_IN);
  });

  it('a bare old doc (no verdict, no fields at all) → checked_in (permissive default)', () => {
    expect(deriveJourneyState({})).toBe(JOURNEY.CHECKED_IN);
    expect(deriveJourneyState(undefined)).toBe(JOURNEY.CHECKED_IN);
    expect(deriveJourneyState(null)).toBe(JOURNEY.CHECKED_IN);
  });

  it('missing `activated` never renders Registered — only an explicit false does (§5)', () => {
    // Missing → permissive checked_in.
    expect(deriveJourneyState({ verdict: { talentComm: [], workComm: [] } })).toBe(
      JOURNEY.CHECKED_IN
    );
    // Explicit false with no verdict → Registered (Phase-7 only).
    expect(deriveJourneyState({ activated: false })).toBe(JOURNEY.REGISTERED);
    // activated === true → permissive checked_in.
    expect(deriveJourneyState({ activated: true })).toBe(JOURNEY.CHECKED_IN);
  });

  it('a truthy-but-not-true `activated` never renders Registered and never blocks (landmine #11)', () => {
    // Only the EXPLICIT boolean false is Registered; any other shape is permissive.
    expect(deriveJourneyState({ activated: 0 })).toBe(JOURNEY.CHECKED_IN);
    expect(deriveJourneyState({ activated: null })).toBe(JOURNEY.CHECKED_IN);
    expect(deriveJourneyState({ activated: undefined })).toBe(JOURNEY.CHECKED_IN);
    expect(deriveJourneyState({ activated: 'true' })).toBe(JOURNEY.CHECKED_IN);
  });

  it('verdict / verdictStatus outrank activated===false (a decided candidate is never Registered)', () => {
    expect(
      deriveJourneyState({ activated: false, verdict: { talentComm: ['x'], workComm: [] } })
    ).toBe(JOURNEY.SELECTED);
    expect(deriveJourneyState({ activated: false, verdictStatus: 'not_selected' })).toBe(
      JOURNEY.NOT_SELECTED
    );
  });

  it('ignores an unknown verdictStatus value and falls back to the array derivation', () => {
    expect(
      deriveJourneyState({ verdictStatus: 'bogus', verdict: { talentComm: ['x'], workComm: [] } })
    ).toBe(JOURNEY.SELECTED);
    expect(
      deriveJourneyState({ verdictStatus: 'bogus', verdict: { talentComm: [], workComm: [] } })
    ).toBe(JOURNEY.CHECKED_IN);
  });
});

describe('hasAnyDomain', () => {
  it('true only when a committee array is non-empty', () => {
    expect(hasAnyDomain({ talentComm: ['a'], workComm: [] })).toBe(true);
    expect(hasAnyDomain({ talentComm: [], workComm: ['b'] })).toBe(true);
    expect(hasAnyDomain({ talentComm: [], workComm: [] })).toBe(false);
  });

  it('is safe on missing / malformed verdict shapes', () => {
    expect(hasAnyDomain(undefined)).toBe(false);
    expect(hasAnyDomain(null)).toBe(false);
    expect(hasAnyDomain({})).toBe(false);
    expect(hasAnyDomain({ talentComm: 'nope' })).toBe(false);
  });
});

describe('isCheckedIn (Phase 7b stat numerator — honest count)', () => {
  it('is true ONLY for an explicit activated === true', () => {
    expect(isCheckedIn({ activated: true })).toBe(true);
  });

  it('is false for a missing field (old doc: permissive to OPERATE, never counted)', () => {
    expect(isCheckedIn({})).toBe(false);
    expect(isCheckedIn({ verdict: { talentComm: ['Music'], workComm: [] } })).toBe(false);
  });

  it('is false for an explicit activated === false (Registered, not yet arrived)', () => {
    expect(isCheckedIn({ activated: false })).toBe(false);
  });

  it('is false for any non-true truthy/garbage value and for nullish inputs', () => {
    expect(isCheckedIn({ activated: 1 })).toBe(false);
    expect(isCheckedIn({ activated: 'true' })).toBe(false);
    expect(isCheckedIn(undefined)).toBe(false);
    expect(isCheckedIn(null)).toBe(false);
  });
});

describe('isWaiting (check-in desk / waiting room — additive VIEW, never a gate)', () => {
  it('is true only for an explicit check-in with no verdict truth', () => {
    expect(isWaiting({ activated: true })).toBe(true);
    expect(
      isWaiting({ activated: true, verdict: { talentComm: [], workComm: [] } })
    ).toBe(true);
  });

  it('is false for a missing activated field (landmine #11: old docs stay fully operable, just not "waiting")', () => {
    expect(isWaiting({})).toBe(false);
    expect(isWaiting({ verdict: { talentComm: [], workComm: [] } })).toBe(false);
  });

  it('is false once verdict truth exists (arrays or explicit verdictStatus)', () => {
    expect(
      isWaiting({ activated: true, verdict: { talentComm: ['Music'], workComm: [] } })
    ).toBe(false);
    expect(isWaiting({ activated: true, verdictStatus: 'selected' })).toBe(false);
    expect(isWaiting({ activated: true, verdictStatus: 'not_selected' })).toBe(false);
  });

  it('is false for not-arrived and nullish inputs', () => {
    expect(isWaiting({ activated: false })).toBe(false);
    expect(isWaiting(undefined)).toBe(false);
    expect(isWaiting(null)).toBe(false);
  });
});

describe('deriveVerdictStatusForWrite (Phase 7a write helper)', () => {
  it('returns "selected" when any domain is chosen (domains win over the flag)', () => {
    expect(deriveVerdictStatusForWrite({ talentComm: ['Music'], workComm: [] }, false)).toBe(
      'selected'
    );
    expect(deriveVerdictStatusForWrite({ talentComm: [], workComm: ['Design'] }, true)).toBe(
      'selected'
    );
  });

  it('returns "not_selected" only on the explicit flag with no domains', () => {
    expect(deriveVerdictStatusForWrite({ talentComm: [], workComm: [] }, true)).toBe(
      'not_selected'
    );
  });

  it('returns undefined (field stays ABSENT) when there is no verdict decision', () => {
    expect(deriveVerdictStatusForWrite({ talentComm: [], workComm: [] }, false)).toBeUndefined();
    expect(deriveVerdictStatusForWrite(undefined, undefined)).toBeUndefined();
  });
});

describe('activatedAtMillis (waiting room — additive activatedAt, every shape tolerated)', () => {
  it('reads a Firestore Timestamp shape ({seconds})', () => {
    expect(activatedAtMillis({ activatedAt: { seconds: 1_753_000_000 } })).toBe(
      1_753_000_000_000
    );
  });

  it('reads an ISO string', () => {
    const iso = '2026-07-20T09:41:00.000Z';
    expect(activatedAtMillis({ activatedAt: iso })).toBe(Date.parse(iso));
  });

  it('is null for missing/absent stamps (old admin check-ins, in-flight serverTimestamp)', () => {
    expect(activatedAtMillis({ activated: true })).toBeNull();
    expect(activatedAtMillis({ activatedAt: null })).toBeNull();
    expect(activatedAtMillis(undefined)).toBeNull();
  });

  it('is null for unparseable garbage', () => {
    expect(activatedAtMillis({ activatedAt: 'not a date' })).toBeNull();
    expect(activatedAtMillis({ activatedAt: {} })).toBeNull();
  });
});

describe('compareByActivatedAt (waiting room order — longest-waiting first)', () => {
  const at = (millis, name) =>
    millis == null ? { name } : { name, activatedAt: new Date(millis).toISOString() };

  it('sorts activatedAt ascending across Timestamp AND ISO shapes', () => {
    const early = { name: 'Late-shape', activatedAt: { seconds: 1_000 } }; // 1,000,000 ms
    const late = at(2_000_000, 'Early-shape');
    expect([late, early].sort(compareByActivatedAt).map((c) => c.name)).toEqual([
      'Late-shape',
      'Early-shape',
    ]);
  });

  it('sorts missing stamps LAST (unknown wait never jumps the queue), then by name', () => {
    const sorted = [at(null, 'Zara'), at(5_000, 'Bala'), at(null, 'Asha')].sort(
      compareByActivatedAt
    );
    expect(sorted.map((c) => c.name)).toEqual(['Bala', 'Asha', 'Zara']);
  });

  it('ties fall back to name so the order is stable', () => {
    const sorted = [at(5_000, 'Riya'), at(5_000, 'Anil')].sort(compareByActivatedAt);
    expect(sorted.map((c) => c.name)).toEqual(['Anil', 'Riya']);
  });
});
