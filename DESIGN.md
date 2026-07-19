# MAFIA Recruitment Dashboard — Design System

**Version 3.0 · 2026-07-19 · Direction: HOUSE LIGHTS (as shipped)**

This document describes the design system that is actually in the code. Source of truth: `src/ui/tokens.css`, `src/ui/base.css`, and the `src/ui/` component files. If this document and the code ever disagree, the code wins and this document is the bug.

---

## 1. Direction and principles

**House Lights.** In a music venue, *house lights up* means work mode — check-in, tickets, money, logistics. *House lights down* means the show — the control board glowing at the back of the room.

- **The interviewer portal runs house-lights-up:** bright, procedural, paper-like (`#F7F5F2` warm paper), impossible to misread on a phone in a glaring room with a candidate watching. One scoped exception: the interviewer Login screen stages itself dark on pure `#000000` (the one full-brand moment); every working screen after it is light.
- **The admin portal runs house-lights-down:** a dark control board (`#0A0612` stage black with the varsity jacket's violet cast) for 5–6 board members staring at live tables for ten hours.

One brand, two lighting states — governed by the brand's own physics: black that turns purple when the light hits it, a six-color spectrum used only as small precise accents, white craft detail on dark. The candidate record is drawn as a ticket, money as a receipt, and anything a human must read aloud or cross-check is monospace.

**The five principles:**

1. **One candidate, one screen, one primary action.** The interviewer portal is a linear state machine (Login → Search → Candidate → Payment → Done), never a scroll of everything. If a screen's single primary action can't be named, the screen is wrong.
2. **Money and destruction get friction; everything else gets none.** Search, navigation, reading: zero confirmation, optimistic, instant. Writes that create payment truth or destroy data: hold-to-confirm or type-to-confirm, with evidence on screen.
3. **State is worn on the surface, identically everywhere.** Every candidate carries labeled state pills with fixed colors used identically in both portals. Amber always means "an unverified claim / someone must act." Color is never the only signal.
4. **Mono is the truth channel.** Reg numbers, verification codes, txn IDs, UPI handles, amounts, timers, timestamps, phone numbers render in JetBrains Mono, always. "Typewriter text = read this exactly" is the one convention a 15-minute demo teaches.
5. **Boring is fast; feedback is inline, never modal-by-default.** Toasts for success, inline errors for validation, sheets only for money/destruction. Zero `alert()` / `window.confirm` anywhere.

---

## 2. Design tokens (as shipped — `src/ui/tokens.css`)

Theme application: interviewer tree is light (`:root` default); the admin tree and the interviewer Login screen wrap themselves in `data-theme="dark"`. Primary buttons in BOTH themes are `--brand-600` fill + white text; on dark surfaces they carry a 1 px `--brand-400` border (≥ 3:1 boundary).

### Fonts and type scale

```css
--font-display: "Bakbak One", "Inter", system-ui, sans-serif;   /* single weight 400, CAPS display only */
--font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

--text-12: 0.75rem;    /* admin captions, uppercase micro-labels */
--text-13: 0.8125rem;  /* meta, helper text */
--text-14: 0.875rem;   /* secondary; ADMIN BODY/TABLE (min) */
--text-16: 1rem;       /* INTERVIEWER BODY + ALL INPUTS (iOS-zoom floor) */
--text-18: 1.125rem;   /* card titles, wordmark in top bar */
--text-20: 1.25rem;    /* section titles */
--text-24: 1.5rem;     /* screen titles, status banners */
--text-30: 1.875rem;   /* candidate name */
--text-40: 2.5rem;     /* ₹ amount, stat numerals, green-room text */
--leading-display: 1.15;
--leading-body: 1.45;
--tracking-display: 0.02em;   /* Bakbak One is condensed — open it slightly at display sizes */
--tracking-caps: 0.06em;      /* 11–12px uppercase micro-labels, weight 600 */
```

### Light theme (interviewer default, `:root`)

```css
/* Neutrals */
--bg: #F7F5F2;
--surface: #FFFFFF;
--surface-sunken: #EFECE7;
--border: #E3DFD8;
--border-strong: #C9C3B9;
--text-1: #211C26;   /* ~15:1 on surface */
--text-2: #5C5563;   /* ~7:1  */
--text-3: #837B8A;   /* ~4.6:1 — never below 14px */

/* Brand: MAFIA violet (measured from club assets; jacket violet is a SURFACE, never an accent) */
--brand-700: #37297B;   /* pressed; 11.9:1 under white */
--brand-600: #453499;   /* PRIMARY fill + light-theme text/links — canonical spectrum violet */
--brand-400: #6A5BC4;   /* dark-theme borders/charts */
--brand-300: #9C8CEA;   /* dark-theme accent text */
--brand-100: #ECE9F8;   /* light tint fills */
--brand-a12: rgba(69, 52, 153, 0.12);
--brand: var(--brand-600);
--brand-text: var(--brand-600);
--on-brand: #FFFFFF;

/* Spectrum (the six canonical dots — sanctioned placements ONLY, never state/semantic) */
--spectrum-red: #C60505;  --spectrum-orange: #E84C07;  --spectrum-amber: #F7B808;
--spectrum-green: #3B9103;  --spectrum-blue: #057CDD;  --spectrum-violet: #453499;

/* Stage glow (dark gradients only, NEVER text) */
--glow-deep: #580888;
--glow-bright: #8828A8;

/* Candidate-state colors (§4) */
--state-dormant-ink: #5C5563;  --state-dormant-tint: #EFECE7;   /* Registered / Unpaid */
--state-ready-ink:   #1D5FBF;  --state-ready-tint:   #E4EDFB;   /* Checked in */
--state-claim-ink:   #8A5A00;  --state-claim-tint:   #FCEFCE;   /* Paid·unverified, walk-in, pending ₹ */
--state-good-ink:    #1E7F4F;  --state-good-tint:    #DFF3E7;   /* Selected, Verified */
--state-no-ink:      #211C26;                                    /* Not selected: ink OUTLINE pill */

/* Semantic */
--success-ink: #1E7F4F;  --success-tint: #DFF3E7;
--warning-ink: #8A5A00;  --warning-tint: #FCEFCE;
--error-ink:   #B3261E;  --error-tint:   #FBEAEA;
--destructive: #C22B2B;  --on-destructive: #FFFFFF;
--focus-ring: var(--brand-600);

/* Spacing (4px scale) */
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px;

/* Radii (semantic, deliberately non-uniform) */
--radius-input: 8px;
--radius-card: 12px;
--radius-sheet: 16px;
--radius-pill: 999px;
--radius-ticket: 12px 2px 2px 12px;   /* asymmetric: the ticket edge */

/* Shadows (light theme; dark uses borders) */
--shadow-1: 0 1px 2px rgba(16, 24, 40, 0.06);
--shadow-2: 0 4px 12px rgba(16, 24, 40, 0.10);
--shadow-sheet: 0 -8px 32px rgba(16, 24, 40, 0.16);

/* Motion */
--motion-micro: 120ms;     /* hover, press, chips, pills */
--motion-screen: 180ms;    /* screen/step transitions */
--motion-sheet: 240ms;     /* sheets, drawers, dialogs, toasts */
--motion-takeover: 350ms;  /* green-room payment flip ONLY */
--ease: cubic-bezier(0.2, 0, 0, 1);
--ease-spring: cubic-bezier(0.34, 1.35, 0.4, 1);  /* the ONE spring: entrances only; exits always --ease */
--stagger: 24ms;           /* the ONE stagger constant: list entrances */

/* Ergonomics */
--touch-min: 44px;
--touch-primary: 56px;
--safe-bottom: env(safe-area-inset-bottom, 0px);

/* Stage canvas (owner call 2026-07-20): dark-theme stage values exposed to the
   light tree for the Search >= 900px canvas */
--stage-bg: #0A0612;
--stage-ink: #F5F2FA;
--stage-ink-muted: #B9B1CC;
```

### Dark theme (`[data-theme="dark"]` — admin + interviewer Login)

```css
--bg: #0A0612;             /* stage black with the jacket's violet cast */
--surface: #140B26;
--surface-sunken: #1D1140;
--border: #2B1D4E;
--border-strong: #3C2C66;
--text-1: #F5F2FA;   /* ~17:1 on surface */
--text-2: #B9B1CC;   /* solid, ~9.3:1 on surface */
--text-3: #8D84A6;   /* solid, ~5.4:1 — never below 14px */

--brand-text: var(--brand-300);
--focus-ring: var(--brand-300);

--state-dormant-ink: #A9A4B2;  --state-dormant-tint: rgba(255,255,255,0.06);
--state-ready-ink:   #7BA7F7;  --state-ready-tint:   rgba(96,138,247,0.12);
--state-claim-ink:   #F5C044;  --state-claim-tint:   rgba(245,182,46,0.12);
--state-good-ink:    #4ADE80;  --state-good-tint:    rgba(34,197,94,0.12);
--state-no-ink:      #F3F1F6;

--success-ink: #4ADE80;  --success-tint: rgba(34,197,94,0.12);
--warning-ink: #F5C044;  --warning-tint: rgba(245,182,46,0.12);
--error-ink:   #F87171;  --error-tint:   rgba(248,113,113,0.12);

--shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-2: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-sheet: 0 -8px 32px rgba(0, 0, 0, 0.6);
```

### base.css (loaded after tokens)

Global reset (`*{box-sizing:border-box;margin:0;padding:0}`), `html{font-size:16px}`, Inter body with `font-feature-settings:"cv05","cv11"`, **`button,input,select,textarea{font:inherit;color:inherit}`** (the fix for the historical Arial-buttons bug), global `:focus-visible` ring, `.tnum` tabular numerals, the app's ONLY keyframes — the five working ones (`spin`, `skeleton-pulse`, `dot-pulse`, `spectrum-seq`, `arc-spin`) plus the sanctioned **CELEBRATION block** (owner 2026-07-20, one-shot only: `celebrate-draw`, `celebrate-pop`, `celebrate-ring`, `celebrate-rise`, `celebrate-settle`, `celebrate-stamp-slam`, `celebrate-confetti`, `celebrate-fleck`) — and one `@media (prefers-reduced-motion: reduce)` block collapsing all animation to opacity ≤ 80 ms, with a second targeted block killing `.celebrate-once` animations outright (celebration base styles are at-rest states, so the collapse is instant static).

---

## 3. Typography

**One Google Fonts stylesheet** in `public/index.html` (with the two `preconnect` lines):

```html
<link href="https://fonts.googleapis.com/css2?family=Bakbak+One&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
```

| Family | Weights | Role |
|---|---|---|
| **Bakbak One** | 400 (its ONLY weight) | Display, CAPS-ONLY: the "MAFIA" text wordmark, screen titles (24 px), candidate name (30 px), stat numerals and green-room text (40 px), the verdict stamp. Never below 18 px, never lowercase body. Tracking `--tracking-display` at ≥ 24 px. |
| **Inter** | 400 / 500 / 600 / 700 | Everything else: body, labels, buttons, table cells, pills. 11–12 px uppercase micro-labels: weight 600 + `--tracking-caps`. |
| **JetBrains Mono** | 500 / 600 | **The truth channel (law, no exceptions):** reg numbers, verification codes, txn IDs, UPI handles, amounts in running text, tickers, timestamps, phone numbers, presence ages. |

Rules as shipped:

- **Single-weight law:** Bakbak One renders at its native 400 everywhere — hierarchy comes from size and caps; bold is never synthesized on display type.
- Inputs and interviewer body never below 16 px (kills iOS auto-zoom without `!important`); admin body/table floor is 14 px; `--text-13`/`--text-12` only in `--text-2`/`--text-3` colors, never on primary actions.
- **Tabular numerals** (`.tnum` or mono) on every ticking number, stat tile, revenue figure, count, fraction, and table numeric column — a ticking number must never jitter.
- Reg numbers render grouped with a middle dot — `23BCE · 7431` (render-only via `formatRegNo`; the stored value is untouched).
- Headline-amount rule: stat-tile numerals and the green room's "PAID ₹300" are Bakbak One display; the Payment-screen ₹300 header and every amount in running text or receipts are mono — wherever a human cross-checks money, the truth channel wins.
- **Digit-uniformity note (Phase 1 check, recorded):** Bakbak One digits are NOT uniform-width — any *animated* display numeral requires the per-digit inline-block lock (`.digit{display:inline-block;min-width:.62em;text-align:center}`) so tiles never jitter. The shipped stat tiles render statically (with `.tnum`), so no lock is currently applied in code; apply it if a count-up animation is ever added.

---

## 4. Candidate-state system

Two orthogonal pill tracks + derivation rules, rendered pixel-identically in both portals by the same `Pill` component (`track`, `state` props). Pills always carry their text label — color is never the only signal; rejection is ink, not red (colorblind-safe).

**Track 1 — Journey:**

| State | Label | Treatment | Derivation (shipped, pre-Phase-7) |
|---|---|---|---|
| Registered | "Registered" | dormant ink, **outline** pill | only when `activated === false` exists (i.e. never pre-Phase-7) |
| Checked in | "Checked in" | ready ink on ready tint, filled | **default**: field absent OR true, no verdict detected |
| Selected | "Selected ✓" | good ink on good tint, filled | any `verdict.talentComm` or `verdict.workComm` array non-empty |
| Not selected | "Not selected" | ink **outline** pill (a decision, not an alarm) | not representable in DB — shown only locally in-session (Done screen) |

**Track 2 — Payment** (orthogonal, from existing `paid` / `manuallyVerified`):

| State | Label | Treatment |
|---|---|---|
| Unpaid | "Unpaid" | dormant ink on dormant tint (neutral — NOT red) |
| Paid · unverified | "Paid · unverified" | claim amber ink on claim tint — a claim, not a fact |
| Verified | "Verified ✓" | good ink on good tint |

**Hard rule:** no UI may ever block, disable, or dim a candidate based on journey state pre-Phase-7. A missing field always renders the permissive state. Amber additionally marks walk-in tickets, the pending-payment chip, and manual-payment tags in admin. Green = terminal-good in both tracks. The board's job reads as "drain the amber."

---

## 5. Component inventory — `src/ui/` (the one library)

One `Component.jsx` + `Component.css` per component; class-based; consumes only CSS variables (no raw hex); every interactive element has `:hover` / `:active` / `:focus-visible` / `:disabled`; every target ≥ 44 px (56 px interviewer primaries). Barrel: `src/ui/index.js`.

| Component | Purpose · variants |
|---|---|
| **Accordion** | Collapsed 44 px question sections (interview questions per domain). |
| **ActionBar** | Sticky bottom primary-action bar, safe-area padded; idle · busy. |
| **Avatar** | Initials circle, 32 / 40 px. |
| **Banner** | Inline full-width message; info · success · warning · error · payment-status (`role="status"`, ticking-content slot) · offline. |
| **Button** | primary (brand fill) · secondary (border) · ghost · destructive; sizes lg 56 / md 48 / sm 44; loading spinner with **width locked**; disabled-with-visible-reason. |
| **Card** | Surface container; default · sunken well; desktop-pointer hover lift. |
| **CelebrationCheck** (+ `CelebrationBurst`, `prefersReducedMotion`) | The drawn tick (SVG circle + tick, `pathLength="1"` stroke-dashoffset draw-in, spring pop; `full` and `brisk` tempos; optional single ring pulse) and the one-shot 32-bit spectrum confetti burst — CSS/DOM only, no canvas, no deps. Always `aria-hidden`; `drawn={false}` renders the mark complete (the neutral "recorded" form); the burst never renders under reduced motion. |
| **Chip** | Small label chip; filter (toggleable `<button>` with `aria-pressed` + live tabular count) · rank (①②③, static) · year (static); variant derived from props. |
| **ConfirmPopover** | Anchored confirm for admin verify/end-session; default · destructive; `working` holds it open. **Caveat: it clamps a fixed-position panel against the viewport — never nest it inside a surface that settles with a CSS `transform` (a transformed ancestor becomes the containing block for `position: fixed` and the coordinates break). Anchor it in untransformed containers only.** |
| **ConfirmSheet** | Mobile Sheet preset for confirms: restates the evidence (who/what/amount); `hold` swaps the confirm Button for HoldButton. |
| **Dialog** | Centered overlay; `danger` renders `role="alertdialog"` + error-ink title; `busy` holds it open until the async op resolves; `typedConfirm={{ word }}` renders the mono type-to-confirm input; **`actions` slot** — the footer: a node, or a render function `({ confirmEnabled }) => …` so footer buttons can react to the typed-confirm state. **Amber-danger pattern:** the Reset dialog wears `className="admin-dialog--warn"` (AdminPortal.css), which recolors the danger border/title/typed-word and confirm fill to `--warning-ink` amber — so recoverable Reset can never be confused with the red Delete-ALL dialog. |
| **DomainToggle** | Full-width 56 px verdict row; domain · not-selected (`negative`: ink outline); on-state = tint + ink + ✓ + weight 600; confirm-on-clear interaction. |
| **Drawer** | Right 420 px panel (admin candidate detail); full-screen ≤ 1024 px; focus-trapped, Esc/backdrop close, scroll lock. |
| **EmptyState** | search-miss · table-empty · error+retry; one CTA max. |
| **HoldButton** | 600 ms radial hold-to-confirm; destructive · brand; early-release spring-back. **Money-touch only.** |
| **Input / Select / Textarea** | Labeled form controls (label required); `mono` variant; error with `role="alert"` + `aria-describedby`; read-only renders as a borderless sunken well. |
| **OfflineBanner** | `navigator.onLine`-driven amber banner ("changes will sync"). |
| **Pill** | The 7 candidate states of §4, two tracks, filled/outline exactly per spec; width-stable label. |
| **PresenceDot** (+ `derivePresence`) | Green solid < 5 m / amber hollow 5–30 m / gray outline > 30 m from `lastActive`, always paired with a mono age ("7m"). |
| **QRPanel** | 280 px payment QR + chunked mono verification-code well; generating · active (ticking status) · timeout · error · receipt. |
| **ResultRow** | 72 px interviewer search-result row: name, mono regNo, year chip, payment pill, chevron. |
| **SearchField** | Debounced live filter field; interviewer 56 px / admin 40 px; clear ✕; inline spinner. |
| **Sheet** | Mobile bottom sheet (money/destruction confirms, account menu); Esc/backdrop/scroll-lock/aria; focus trap + restore. |
| **Skeleton** | Loading placeholder; text · row · tile; `skeleton-pulse`. |
| **SpectrumDots** | The six canonical dots — static row (login/lockups) and `spectrum-seq` loader (boot splash / dark full-surface loads only). On dark grounds the violet dot renders as `--brand-400` and red may soften; never inside buttons, never on light working screens. |
| **Stamp** | Verdict stamp, Done screen ONLY: Bakbak One caps in a 2 px border at −2°, all selected domains joined with "+"; selected (green) · not-selected (ink). Entrances: `spring` (default) · `slam` (celebration keyframe, selected Done) · `quiet` (opacity-only, not-selected Done). |
| **StatTile** | Admin stat tile: uppercase micro label + 40 px display tabular value + sub line; plain · actionable (amber, clickable `<button>`); loading renders "—", never 0. |
| **TableRow** | Admin 44 px table row; hover, pressed, focus-visible, green flash-success overlay. |
| **Ticket** (+ `formatRegNo`) | Candidate identity as a physical ticket: 1.5 px ink border, `--radius-ticket`, dashed perforation, pill stub; standard · walk-in (amber stub) · compact (admin drawer header) · condensed (sticky scroll). |
| **Toast / ToastHost** (+ `toast` emitter) | success · error · info · **undo** (10 s countdown ring, tabular seconds); max 2 queued; bottom-center above ActionBar (mobile) / bottom-right (admin); `aria-live="polite"`. |
| **TopBar** | Portal chrome; interviewer (wordmark / condensed ticket + sync dot + pending-₹ chip + avatar) · admin (lockup + spectrum hairline + ticking sync pill + export + overflow). |
| **useFocusTrap** | Shared hook: focus trap + focus restore + Esc handling for all overlay components. |

---

## 6. Motion

- **Tokens:** `--motion-micro` 120 ms (hover, press, chips, pills, row flash) · `--motion-screen` 180 ms (screen transitions) · `--motion-sheet` 240 ms (sheets, drawers, dialogs, toasts) · `--motion-takeover` 350 ms (green room ONLY). Easing: `--ease` everywhere; **`--ease-spring` is the ONE spring, entrances only** (sheets/drawers/dialogs/toasts/stamp/ticket-settle) — exits always use `--ease`. **`--stagger` (24 ms) is the ONE stagger constant** — list entrances only.
- **Laws:** transform + opacity only (never width/height/background-position) — plus `stroke-dashoffset`, sanctioned for the toast undo ring and the celebration draw; status colors crossfade via stacked opacity layers; **all keyframes live in `base.css`** — the five working ones (`spin`, `skeleton-pulse`, `dot-pulse`, `spectrum-seq`, `arc-spin`) plus the **CELEBRATION block** (owner 2026-07-20: `celebrate-draw/-pop/-ring/-rise/-settle/-stamp-slam/-confetti/-fleck`, one-shot only) — no keyframes anywhere else; zero runtime `<style>` injection; nothing blocks input; nothing loops except the two loaders and the presence pulse (celebration animations run ONCE, fill-mode both).
- **Outcome-mapped intensity (hard rule, owner 2026-07-20):** celebration scale follows the candidate's outcome. SELECTED → the full beat (the green room: drawn tick + pop + ONE ring pulse + the spectrum confetti burst; Done then carries only the mild echo — brisk drawn tick, staggered rises, stamp slam, five drifting flecks). NOT SELECTED → **zero festivity**: the ✓ becomes a neutral ink "recorded" mark (complete, static), the stamp enters quiet (opacity-only at its −2° seat), no rises, no flecks — a rejected student's record gets gravity, not balloons. Confetti exists in the green room ALONE (which is only ever reached by a selected candidate paying); saves that land directly on Done (walk-in/already-paid/cancelled-payment) top out at the mild echo. Reduced motion: everything collapses to instant static — drawn strokes appear complete and the transient bits (confetti, flecks) never render at all (JS-suppressed and CSS-killed). The celebration frames the facts, never obscures them: decoration is `aria-hidden` and the `role=status` lines are untouched.
- **Choreographed inventory (shipped):** screen transitions (out 90 ms fade, in 12 px translate + fade 180 ms); search-result entrance (8 px translate + fade, i × `--stagger`, first 8 rows, fresh query only); ticket condense-on-scroll (scroll-driven transform/opacity, spring settle); spectrum-dot loader (boot splash + dark full-surface loads); record-arc spinner (`arc-spin`, panel loads; button spinners stay plain `spin`); sheets/drawers/dialogs (translate/scale + fade, 240 ms spring in / ease out); pill state crossfade (120 ms, width-locked container); verdict stamp (spring scale 1.06 → 1.0 default; on Done: SLAM — rotation overshoot −5° → −1.3° → −2° settle at 420 ms — for selected, opacity-only quiet fade for not-selected); **the green room choreography** (350 ms crossfade + 2.5 s auto-advance mechanics untouched; within them: circle stroke draws 80–540 ms, tick 540–780 ms, pop + single ring pulse at 780 ms, 32-bit spectrum confetti burst at 820 ms — every bit gone by ≈2290 ms, per-bit life ≤ 1.47 s; amount settles with weight 260–740 ms; name/txn/Continue rise at 430/560/700 ms); **the Done artifact entrance** (selected only: brisk drawn tick 60–560 ms, title/rules/pill/actions/lockup rising 140–740 ms, five spectrum flecks drifting once, gone ≤ 1.75 s); QR reveal (panel translate + staggered code well); toasts (translateY + fade, undo ring 10 s `stroke-dashoffset`); HoldButton radial fill; row flash (120 ms in / 800 ms out) + presence `dot-pulse`.
- **Named exceptions to the duration tokens:** HoldButton gesture timings (600 / 100 / 60 ms — a safety gesture, not decoration), table-row flash decay (120/800 ms), the toast undo ring's 10 s countdown, the loader loop periods (1.2 s spectrum cycle, 900 ms arc), the celebration choreography constants (the §6 ms timeline above — one-shot, tuned as a sequence, not reusable tokens), and the stat count-up (≤ 600 ms JS interpolation, `--ease`). The **stat count-up ships in the admin stat strip** (`src/screens/admin/AdminStats.jsx` `CountUp`): numerals animate previous → new on real data changes only (a target ref guards against snapshot re-renders), digits use the §4 per-digit width lock so Bakbak One's proportional numerals never jitter, en-IN currency lands exactly on the value, and reduced motion sets the final value instantly. `StatTile` itself stays a static presentational tile.
- **Optimistic pattern:** verdict submit and admin verify render success immediately. The **interviewer verdict undo is a persistent ghost "Undo verdict" button on the Done screen** (owner decision 2026-07-20, replacing the 10 s toast countdown — the save toast is now plain): offered only while the interviewer is still looking at the result, cleared by any route away (Next candidate, opening a candidate/walk-in/draft, back to Search, sign-out, another submit) and by **any payment activity for that candidate** (QR session created, manual mark-paid, payment-confirmed poll event) — the captured snapshot predates payment writes, so undoing after one would wipe the payment fields. **Admin is unchanged**: verify/check-in keep the 10 s Undo toast, and the drawer's persistent "Reverse verification" action stands. Every undo re-issues the captured prior snapshot through the same write path with the stale-write abort check (`src/undoGuard.js` — "Changed by {name} just now — not undone"). Payment status is NEVER optimistic — server truth only, with a ticking "last check" line.
- **Reduced-motion law:** one global block in `base.css` — everything collapses to opacity ≤ 80 ms, staggers and springs collapse, loaders freeze to static forms; the HoldButton hold duration is unchanged (safety gesture, not decoration).

---

## 7. Accessibility

- **Contrast floors:** all text pairings ≥ 4.5:1 (`--text-3` restricted to ≥ 14 px); pills are dark ink on light tint (light) / bright ink on 12 %-alpha tint (dark), never white-on-tint; primary buttons 9.5:1; non-text boundaries ≥ 3:1 (primaries get the 1 px `--brand-400` border on dark).
- **Color never alone:** every pill carries a word; toggles carry ✓ + weight change; Selected (green) vs Not-selected (ink outline) is red-green-safe; presence dots pair with mono ages.
- **Touch targets:** 44 px minimum in both portals via component sizing; 56 px for interviewer primaries, verdict rows, UPI cards; full-row hit areas; ≥ 8 px gaps; ActionBar/sheets padded with `--safe-bottom`.
- **Focus:** global `:focus-visible` 2 px `--focus-ring` + 2 px offset on everything; admin fully keyboard-operable (rows tabbable, Enter opens drawer, Esc closes); focus trapped in sheets/dialogs/drawers/popovers and restored on close (`useFocusTrap`).
- **Aria patterns:** inline errors `role="alert"` + `aria-describedby`; toasts `aria-live="polite"`; payment status Banner `role="status"`; destructive dialogs `role="alertdialog"`; `busy` overlays set `aria-busy`; real `<label>` on every input; landmarks (`<nav>/<main>/<h1>–<h3>`); all clickables are `<button>`; help numbers are `tel:` links.
- **The mono-in-a-well convention:** anything that must be read aloud or checked exactly — regNo, verification code, txn ID — sits in a bordered `--surface-sunken` well in JetBrains Mono, grouped/chunked (`23BCE · 7431`, `K7F · 2Q9`), rendered as selectable text. One learned pattern: *mono in a well = read this exactly.*
- **Ergonomics:** 16 px minimum input font (no iOS zoom); one-handed thumb-zone primaries; layout responds to rotation via CSS media queries, never JS width checks.

---

## 8. Per-portal layout patterns

### Interviewer (`/`) — 375-first, five-screen state machine

`screen ∈ {login, search, candidate, payment, done}` held in App.js state; Firebase handlers stay in App.js; each screen is a presentational component in `src/screens/interviewer/`. Designed at 375 px, enhanced upward (desktop: 560 px centered column). Global chrome: 48 px TopBar (text wordmark / condensed ticket, sync dot, amber pending-₹ chip, avatar sheet), sticky bottom ActionBar with the screen's ONE primary action, no bottom nav, no counters of any kind on any interviewer surface. Login is the one dark-staged screen (pure `#000000`, ≤ 8 % `--glow-deep` radial, showbill lettering under `mix-blend-mode: screen`); Search/Candidate/Payment/Done are light. Payment confirmation is the green room: a full-viewport takeover legible from two meters — since the celebration pass (owner 2026-07-20) a choreographed one-shot sequence inside the untouched 350 ms crossfade + 2.5 s auto-advance: the drawn tick, the pop with its single ring pulse, the spectrum confetti burst, the ₹300 settling with weight, name/txn rising staggered (the §6 timeline; the celebration frames the facts, never obscures them). Done is composed as a printed receipt on the white paper the owner keeps: mark + name header, hairline rule, Stamp + payment pill body, dashed perforation, actions, wordmark footer — intensity outcome-mapped per §6 (selected: the mild echo with the stamp slam and five drifting flecks; not selected: zero festivity, neutral ink mark, quiet stamp). **The payment flow correction (owner decision 2026-07-20): manual confirm-by-interviewer is the primary payment action; the auto-confirm assumption is retired.** There is no gateway and no bank sync — nothing external ever writes to the 30 s `paymentSessions` poll — so the interviewer, who watches the payment land (club UPI app / candidate's success screen), confirms it: the 600 ms HoldButton ("Hold to confirm — ₹300 received") is the Payment screen's sticky-ActionBar primary, with the {name} + ₹300 restatement visible at the moment of holding; it drives the same mark-paid write the old buried "Other options" sheet did, and the result stays amber "Paid · unverified" until the board verifies. The status line reads the poll honestly ("QR shown — confirm below once you see the payment land · last check m:ss") and never implies automatic confirmation; Cancel payment lives in the bar's ⋯ overflow; Back is the TopBar chevron.

**Brand assets — `public/brand/` ships five files:** `logo-disc.png`, `wordmark-black.png`, `wordmark-white.png`, `login-stage-a.jpg` (the Cadenza night photograph — owner-supplied, photographer-credited to Debrato Ghosh, watermark cropped with permission — graded dark; the Search stage backdrop at 0.45/top-fade/viewport-fixed ≥ 900px AND the Login video's poster + phone/reduced-motion fallback), and `login-stage.mp4`: the drone flight over the quad (owner-supplied DJI shot, trimmed from 4s, 21s loop with a breathing black seam, 1600×900 24fps ≈ 2.7 MB, desaturated + dimmed) playing muted/looped under the Login at 0.5 opacity beneath the black gradients + vignette — ≥ 768px with motion allowed only; the ornate showbill lettering was retired from the Login when the video landed (owner call 2026-07-20). **The stage canvas (owner call 2026-07-20):** at ≥ 900px the Search, Candidate AND Payment screens run their canvas dark (`--stage-bg`) while every content surface stays paper — white cards popping on the night; the interviewer TopBar dissolves into the canvas on those screens (`ui-topbar--stage`). Canvas-level text uses `--stage-ink`/`--stage-ink-muted`/`--brand-300`. Phones and 768–900px keep the paper canvas: glare wins on the working device. Payment joined the stage with the flow correction (2026-07-20): the screen reads as zone panels in the candidate screen's zone language — amount (condensed identity + mono ₹300), account (UPI radio cards), QR — and on the night the live QR zone's panel dissolves so the QRPanel's white card floats directly on the stage (the white QR card is preserved exactly: scan contrast is law). **The spectrum hover ring (owner call 2026-07-20):** ResultRow hover shows a moving six-color spectrum ring (conic disc rotating via the existing `spin` keyframes, transform-only, hover-only, 2px, static under reduced motion); uniform for every row — an affordance, never a data encoding; row content sits above all overlay layers.

### Check-in desk (`/`, third role — 2026-07-20)

Same Google sign-in as the interviewer portal; after auth, App.js resolves the role LIVE from `config/checkinDesk { emails: [...] }` (single-doc onSnapshot; signed-in sessions hold the boot splash until the first role snapshot so neither portal ever flashes for the wrong role). A desk account renders `src/screens/desk/Desk.jsx` instead of the interviewer state machine — Candidate/Payment/verdict surfaces are simply never routed for them; the only reachable writes are the additive check-in pair (`activated`, `activatedAt` + updated-meta) through the same merge-update path the admin check-in uses. The screen is the front desk's calling sheet: full live candidate list (search narrows, first 30 + "Show more", slotOrder-then-name ordering), paper card rows (name · mono regNo · year · journey pill · tap-to-call `tel:` WhatsApp link · slot chip when the time-slot layer has data) with ONE action, "Check in"; checked-in rows show the quiet mono "✓ Checked in {time}" whose tap asks "Mark as not arrived?" (ConfirmPopover → explicit `activated:false`, the honest Registered state). Row tap opens the FULL read-only record in the right Drawer (admin record-body patterns: identity dl, rank-chip preferences, comments — no verdict controls, no payment block). Sticky under the TopBar: live "Checked in X / Y" + amber "Waiting {N}" (`isWaiting` — explicitly checked in, no verdict; an additive §5 VIEW, never a gate). **The desk counts are sanctioned:** §9 ban #6 is scoped to interviewer surfaces, and the count IS the desk's job. Aesthetic: the stage canvas language — dark canvas ≥ 900px with stage inks on canvas-level text (the amber Waiting count rides its own claim-tint chip so ink never sits on the canvas), paper below; rows stay paper cards on both. Admin manages the allowlist from the ⋯ overflow ("Check-in desk…" → live add/remove Dialog writing the whole `emails` array).

**Role-gating honesty (recorded, not negotiable):** the desk/interviewer split is UI-level separation on the existing trust model — any signed-in college account can technically write to Firestore surfaces beyond its portal. `config/checkinDesk` routes roles; it does not enforce them. Firestore rules hardening (scoping desk accounts to the check-in fields) is future work — nothing in this document claims otherwise.

### Admin (`/admin`) — laptop-first, one screen + drawer

Entire tree (login included) wrapped in `data-theme="dark"`. One honest screen, no sidebar: topbar (white lockup, 2 px six-segment spectrum hairline, ticking "Synced Ns ago" pill, Export with scope popover, overflow menu) → 4-tile stat strip (auto-fit `minmax(180px,1fr)`) → candidates table card (40 px SearchField, filter chips with live counts, 14 px text / 44 px rows, sticky header, hand-rolled IntersectionObserver windowing at 100-row pages) beside the interviewers + activity cards at ≥ 1280. Row click opens the 420 px right Drawer headed by the compact Ticket — verify/reverse actions sit next to the evidence, guarded by ConfirmPopover / Dialog. At 768–1024: single-column stack, table scrolls horizontally inside its card, drawer becomes a full-screen overlay. Danger zone: amber `RESET` dialog vs red `DELETE` dialog, both `busy`-held open.

---

## 9. Anti-patterns (bans, enforced by the Phase 6 grep gates)

1. **No raw hex in components** — every color comes from a token in `tokens.css`. The retired palettes (old neon magentas, the raspberry ramp, the generic dark neutrals) are grep-banned from the codebase.
2. **No new keyframes** — the five working keyframes plus the CELEBRATION block (owner 2026-07-20) in `base.css` are the complete set; new animation composes transforms/opacity with the existing tokens. Celebration keyframes are one-shot ONLY (never looped, never repurposed as loaders/attention-getters) and never fire for a not-selected outcome.
3. **No runtime style injection** — zero `<style>` tag creation, zero `document.head.append`.
4. **No `alert()` / `window.confirm`** — toasts, inline errors, Banner, Sheet/Dialog/Popover only.
5. **Spectrum never on data UI** — the six dots appear ONLY as the loader, the static lockup/login rows, the admin topbar hairline, the ResultRow hover ring, and the one-shot celebration bits (the green-room confetti burst; the five Done flecks, selected outcomes only); never on pills, semantic colors, charts-as-state, or washes; no domain-colored chips. Celebration bits are decoration (`aria-hidden`, transient, never a data encoding).
6. **No counts on interviewer surfaces** — "N today" and throughput live only in the admin interviewers panel (owner decision); the interviewer portal never shows a counter.
7. **Single-weight display** — Bakbak One is 400 only, caps only, ≥ 18 px; never synthesize bold on display type.
8. Additionally: no `window.innerWidth` layout ternaries (CSS media queries only); journey state never blocks/dims a candidate pre-Phase-7; payment status never optimistic; hold-to-confirm on touch money only; typed-confirm on desktop destruction only; `--ease-spring` never on exits; `--radius-ticket` only on the Ticket.

---

*v3.0 supersedes v2.0 (the pre-redesign `theme/tokens.js` system, deleted in Phases 4–5). Written against commits `477a4ee` (phase-0) through `656b078` (phase-5e).*
