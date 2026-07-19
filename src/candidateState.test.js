// §5 candidate-state — the single source of truth for the Track-1 Journey
// derivation (Phase 7a). Guards the golden rule (landmine #11): missing
// additive fields ALWAYS render the permissive state; old docs behave exactly
// as pre-Phase-7. Pure module — no firebase, no App.js.
import {
  JOURNEY,
  hasAnyDomain,
  deriveJourneyState,
  deriveVerdictStatusForWrite,
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
