# CLAUDE.md — working on this codebase

Guide for an AI agent (Claude or otherwise) working on the MAFIA Recruitment Dashboard. Read this before changing anything. The human-facing overview is `README.md`; the design system is `DESIGN.md`; the original spec is `REDESIGN_PROMPT.md`.

## What this is

A React (Create React App) + Firebase (Firestore/Auth/Hosting) app for a university club's recruitment. Live at `mafia-recruitments.web.app`. It was fully redesigned from a 2,500-line spaghetti `App.js` into a token-driven design system with a strict split between look and behaviour. Three roles: **interviewer** (Google auth), **admin/board** (email+password), **check-in desk** (name + shared code over an anonymous Firebase session).

## Architecture — the split that everything depends on

- **Logic lives in `.jsx`.** `src/App.js` owns interviewer + desk state, routing (a `screen` state machine: login → search → candidate → payment → done), and every interviewer/desk Firestore read & write. `src/AdminPortal.jsx` owns all admin logic & writes. Screens under `src/screens/**` are **presentational** — they take props/callbacks and render; they never import firebase.
- **Look lives in CSS.** `src/ui/tokens.css` holds every design value as a CSS custom property (`--brand-600`, `--space-4`, `--radius-card`, `--motion-sheet`…). `src/ui/base.css` has the reset + the ONLY keyframes. Each component is `src/ui/<Name>.css`; each screen is `src/screens/**/<Name>.css`. A reskin = change token values and/or component CSS. Never edit `.jsx` for a visual change.
- **`src/candidateState.js`** is the single source of truth for candidate-state derivations (journey pill, payment pill). Everything routes through it.

## THE LAWS (invariants — do not break these)

1. **Tokens only.** No raw hex/rgb in component or screen CSS — use the `tokens.css` variables. (Sanctioned exceptions, commented in-file: the `Login.css` `#000000/#ffffff` stage literals, and the login stage-scrim / video-grade `rgba(0,0,0,*)` values.)
2. **No new `@keyframes` outside `base.css`.** Motion is transform/opacity only, via the motion tokens + the two named easings (`--ease`, `--ease-spring`) + `--stagger`. Named exceptions live in `base.css` under a CELEBRATION comment block. Reduced-motion collapses everything globally in `base.css`.
3. **Permissive state derivations (landmine #11).** Candidate docs may lack newer fields (`activated`, `verdictStatus`, `slot`, `activatedBy`, `paymentDetails.method`). A missing field ALWAYS renders the permissive state and NEVER blocks/dims/hides a candidate. Empty verdict arrays → "checked-in/unseen", never "not selected".
4. **Additive schema only.** Never rename or remove a Firestore field. New fields are additive and optional.
5. **The Jest fixtures are byte-identity guards.** `src/candidatePayload.js` + `src/__fixtures__/candidate-payload.json`, and `src/exportRows.js` + its fixtures, lock the Firestore write payload and the Excel export shape. If you legitimately change a payload/export, update the fixture in the same change and understand why. Never edit a test to force a pass.
6. **Payment is admin-only to correct.** Interviewers *claim* payments (hold-to-confirm → amber "Paid · unverified"); only the board *verifies* (→ green) or reverses. Interviewers can edit verdict/prefs/comments by resubmitting but must never mutate payment. **A resubmit must preserve existing payment fields byte-for-byte** (`buildCandidatePayload` spreads-then-overrides; there is a guard test — keep it green).
7. **Interviewer vs admin pill scope.** Interviewer/desk surfaces show payment as **two-state** only (Paid / Unpaid, unpaid in amber) via `deriveInterviewerPayment`. Admin keeps the full three-state (unpaid / paid_unverified amber / verified green). Amber means "collect money" to an interviewer, "unverified claim" to the board — same colour, portal-scoped meaning.
8. **No interviewer-visible counts** (no "N today"). Counts live only on the admin board. No `alert()` / `window.confirm` anywhere — toasts, inline banners, sheets/dialogs.
9. **Accessibility floors:** text contrast ≥ 4.5:1, touch targets ≥ 44px (56px interviewer primaries), visible focus ring.

## Owner operational truths (real-world facts the design encodes)

- **There is NO automatic payment confirmation** — no gateway, no bank sync. The 30s `paymentSessions` poll never receives external writes (effectively vestigial). Every confirmation is a human. That's why "manual" was purged from all UI copy (stored field NAMES like `manuallyVerified` stay).
- **Check-in** (`activated`/`activatedAt`) is done by the desk role; it's oversight, never a gate.
- **Cash is a real payment mode** (`paymentDetails.method === "Cash"`, no QR). Cash claims never hit a bank statement — the planned Phase-8 reconciliation must exclude them from any "no bank credit" fraud list.
- The founding year is disputed (jacket says 1982, LinkedIn 1979) — **print no founding year anywhere.**

## Trust model & security (be honest about this)

Role separation is currently **UI-level** on a shared trust model — most Firestore access is permissive, and the app assumes signed-in college users behave. The ONE rule-enforced boundary is the **desk**: `firestore.rules` restricts an anonymous (`isDesk()`) session to reading candidates + writing ONLY the five check-in fields (`activated`, `activatedAt`, `activatedBy`, `lastUpdatedBy`, `lastUpdatedAt`) — verdicts/payments/deletes require verified accounts. Real hardening (locking down verdict/payment writes in rules) is future work; don't claim the UI is security.

## Build / test / gate (run these before every commit)

```bash
npm run build                              # must compile (3 known pre-existing warnings: App.js exhaustive-deps ×2, security.js unused import)
CI=true npm test -- --watchAll=false       # must be all green; test count only grows (185 at last count)
```
Commit convention: `type(scope): summary` with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Never push unless asked.

## Deploy pipeline (important mental model)

`firebase deploy --only hosting` builds nothing — it uploads the local `build/` folder straight to Firebase. It does NOT deploy from GitHub. So: **live ≠ pushed.** Always `npm run build` first. Firestore rules deploy separately: `firebase deploy --only firestore:rules`.

## Standing owner actions (not code — flag, don't fake)

1. Enable **Anonymous** sign-in in the Firebase console → activates the desk name+code login (until then it shows "not enabled yet" gracefully).
2. `firebase deploy --only firestore:rules` → enforces the desk write-scope.
3. Rotate the old admin password if that account is still used (old `/setup` hardcoded `mafiaadmin2025`; purged from code, still in old git history).
4. Supply a real time-slot Excel (slot import parser fixtures) and later bank statements (Phase-8 reconciliation).

## Gotchas

- The repo has had an **auto-commit/auto-restore process** active — it sometimes commits working-tree edits under its own message. If a `git add`/commit finds "nothing staged," check `git log` — your change may already be committed. Don't fight it; verify and move on.
- Interviewer/admin/desk screens are auth-gated — an agent can't reach them without credentials. Verify via reading code + the Jest suite + jsdom renders; visual verification of gated screens belongs to the owner's signed-in session.

## Key files

`DESIGN.md` (design system, §-referenced) · `REDESIGN_PROMPT.md` (original spec) · `design-handoff/` (Figma package) · `src/ui/tokens.css` (the reskin lever) · `src/candidateState.js` (state truth) · `firestore.rules` (the one enforced boundary).
