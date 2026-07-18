// Phase 0 safety fixture (landmine #1): buildCandidatePayload must keep producing
// the exact Firestore payload handleSubmit wrote before the extraction.
// Imports ONLY the pure module and the committed fixture — no firebase, no App.js.
import { buildCandidatePayload } from './candidatePayload';
import fixture from './__fixtures__/candidate-payload.json';

describe('buildCandidatePayload', () => {
  it('returns the byte-identical Firestore payload for the fixed fixture inputs', () => {
    const result = buildCandidatePayload(fixture.formData, fixture.meta);
    expect(result).toEqual(fixture.expected);
  });
});
