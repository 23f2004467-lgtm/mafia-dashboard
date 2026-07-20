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

// Owner operational truth (2026-07-20, the "Diptangshu" case): an interviewer
// may edit verdict/preferences/comments/details and RESUBMIT at any time — but
// a resubmit must NEVER strip an existing payment (interviewers never touch
// payment; corrections are admin-only). This is now load-bearing, so it is
// pinned: the builder spreads formData first and only overrides the meta +
// additive verdictStatus fields, so paid / paymentDetails (and the admin-only
// manuallyVerified flag) ride through byte-identically. buildCandidatePayload
// is the entire submit-path write mapping (performSubmit does
// setDoc(ref, buildCandidatePayload(formData, ...))), so proving it on the
// builder proves it on the submit path.
describe('buildCandidatePayload — resubmit preserves payment (owner truth 2026-07-20)', () => {
  // A candidate already marked paid (cash) AND board-verified, loaded into the
  // form for a verdict edit. No HTML-special chars anywhere, so sanitizeInput
  // is a strict no-op — the build is idempotent and the assertions are exact.
  const paidCandidate = {
    name: 'Diptangshu Roy',
    regNo: '23BCE1001',
    year: '1st Year',
    college: 'VIT-AP University',
    branch: 'Mechanical Engineering',
    whatsappNumber: '9876500000',
    preferences: {
      talentComm: { pref1: 'Music', pref2: '' },
      workComm: { pref1: 'Design', pref2: '', pref3: '' },
    },
    verdict: { talentComm: [], workComm: [] },
    comments: 'Reliable',
    paid: true,
    paymentDetails: {
      transactionId: 'MAFIA_TXN_777',
      amount: '300',
      method: 'Cash',
      timestamp: '2026-07-19T09:00:00.000Z',
      verified: true,
    },
    manuallyVerified: true,
    lastUpdatedBy: 'earlier@mafiaclub.example',
    lastUpdatedAt: '2026-07-19T09:00:00.000Z',
  };

  const meta = {
    docKey: '23BCE1001',
    nowIso: '2026-07-20T12:00:00.000Z',
    userEmail: 'editor@mafiaclub.example',
    notSelected: false,
  };

  it('carries paid + paymentDetails + manuallyVerified untouched when a verdict is ADDED', () => {
    // The edit: the interviewer flips this paid candidate to SELECTED.
    const edited = {
      ...paidCandidate,
      verdict: { talentComm: ['Selected for Music'], workComm: [] },
    };
    const payload = buildCandidatePayload(edited, meta);

    // Payment survives the verdict edit — byte-identical values...
    expect(payload.paid).toBe(true);
    expect(payload.paymentDetails).toEqual(paidCandidate.paymentDetails);
    // ...and literally spread-through (same object ref, never cloned/rebuilt).
    expect(payload.paymentDetails).toBe(edited.paymentDetails);
    // The admin-only board-verified flag also rides through an interviewer edit.
    expect(payload.manuallyVerified).toBe(true);

    // The edit itself landed, and only the meta + additive field moved.
    expect(payload.verdict).toEqual({
      talentComm: ['Selected for Music'],
      workComm: [],
    });
    expect(payload.verdictStatus).toBe('selected');
    expect(payload.lastUpdatedBy).toBe('editor@mafiaclub.example');
    expect(payload.lastUpdatedAt).toBe('2026-07-20T12:00:00.000Z');
  });

  it('preserves payment when a paid+selected candidate is re-rejected (not_selected edit)', () => {
    // The edit: the interviewer corrects a mis-selection to NOT SELECTED.
    const edited = {
      ...paidCandidate,
      verdict: { talentComm: [], workComm: [] },
    };
    const payload = buildCandidatePayload(edited, { ...meta, notSelected: true });
    expect(payload.paid).toBe(true);
    expect(payload.paymentDetails).toEqual(paidCandidate.paymentDetails);
    expect(payload.verdictStatus).toBe('not_selected');
  });

  it('is idempotent across repeated resubmits — payment never erodes', () => {
    const once = buildCandidatePayload(paidCandidate, meta);
    const twice = buildCandidatePayload(once, {
      ...meta,
      nowIso: '2026-07-20T13:00:00.000Z',
    });
    expect(twice.paid).toBe(true);
    expect(twice.paymentDetails).toEqual(paidCandidate.paymentDetails);
    expect(twice.manuallyVerified).toBe(true);
  });
});
