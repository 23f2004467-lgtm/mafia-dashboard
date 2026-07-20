# MAFIA Dashboard — Designer Handoff

**For a Figma designer redesigning the look without touching functionality.**

Live app: https://mafia-recruitments.web.app
Full written design system: [`DESIGN.md`](../DESIGN.md) at the repo root (read this first — it explains the intent, the "House Lights" two-lighting-states model, and every rule).

---

## Why you can redesign this safely

The app is built so the **look** and the **behaviour** live in different files:

| Layer | Files | What it controls | Safe to change? |
|---|---|---|---|
| **Design tokens** | `src/ui/tokens.css` | Every colour, font, size, spacing, radius, shadow, motion value | ✅ **Yes — this is the main reskin lever** |
| **Component styles** | `src/ui/<Name>.css` | How each UI piece looks (button, pill, card, ticket…) | ✅ Yes — visual only |
| **Screen styles** | `src/screens/**/*.css` | Per-screen layout & composition | ✅ Yes — visual only |
| **Logic** | `src/**/*.jsx` | What buttons do, data, auth, writes | ⛔ **Don't touch — you never need to** |

Because the `.jsx` files hold all behaviour and you only edit `.css` values, **the functionality cannot break from a visual redesign.** Change a token, the whole app reskins. Change a component's `.css`, that component restyles everywhere it appears.

---

## Three levels of change (pick the smallest that does the job)

1. **Reskin via tokens** (biggest impact, zero risk) — change values in `tokens.css`: brand colour, the neutral/paper palette, fonts, the type scale, spacing rhythm, corner radii, shadows, motion timing. Almost any "make it feel different" goal is a token change.
2. **Restyle a component** — edit one `src/ui/<Name>.css` file (e.g. make every button flatter, every card sharper). Applies app-wide, consistently.
3. **Recompose a screen** — edit a `src/screens/**/*.css` file for layout on one screen. If a change needs *elements added or removed* (not just restyled), flag it — that's a `.jsx` edit and the developer does it with you.

---

## Getting the design INTO Figma (three ways, use all)

### A. Import the tokens as Figma variables — `mafia-tokens.json`
1. In Figma, install the free **Tokens Studio for Figma** plugin.
2. Plugin → **Import** → upload `design-handoff/mafia-tokens.json`.
3. You now have every colour / type / spacing / radius / shadow as organised Figma tokens, split into a `core` set plus **Light** (interviewer working screens) and **Dark** (admin board + login) themes. Design against these and your work maps 1:1 back to code.

### B. Import the live UI as editable layers — `html.to.design`
1. Install the free **html.to.design** Figma plugin.
2. Import the URL **https://mafia-recruitments.web.app** — you'll get the **login** screen as real, editable Figma frames with the actual styles.
3. The other screens (search, candidate, payment, admin, etc.) are behind Google sign-in, so the plugin can't reach them from the URL alone. Two options: the owner adds your Google email as an interviewer/admin so you can sign in and import each screen, **or** ask the developer to export static HTML snapshots of each screen for you to paste into the plugin.

### C. The written spec — `DESIGN.md`
The complete system in prose: principles, the candidate-state pill language, motion inventory, accessibility floors, per-portal layout patterns, and the "anti-patterns" list (what to avoid). This is your source of intent.

---

## Fonts (all free — use the same in Figma)

- **Bakbak One** — display / the "MAFIA" marquee. Single weight, CAPS only.
- **Inter** — everything else (body, buttons, labels, tables).
- **JetBrains Mono** — the "truth channel": reg numbers, codes, amounts, timers, phone numbers.

All three are on Google Fonts. Install them in Figma so your mockups match.

---

## The few rules worth keeping (they're load-bearing, not decoration)

These make the app usable at a loud, bright recruitment venue on cheap phones. Break them only deliberately:

- **Two lighting states.** Interviewer *working* screens are light warm paper (readable under glare, phone-first). Admin + the login are the dark "stage." Payment stays pure white (QR contrast).
- **The state pills are a fixed language.** Amber = "money outstanding / attention." Green = "done / good." Not-selected is an ink outline, never red. Colour is never the only signal — every pill has a word.
- **The six-colour spectrum is a rare signature** — loaders, lockup dots, one hairline. Never on data or state.
- **Mono = "read this exactly."** Keep reg numbers / codes / amounts monospace.
- **Accessibility floors:** text contrast ≥ 4.5:1, touch targets ≥ 44px (56px for primary interviewer actions), a visible focus ring. The tokens already pass — keep new pairings passing.

---

## Handing it back (how your design becomes code, safely)

You don't need to write code. Return **either**:
1. **Updated token values** — the fastest path. Export from Tokens Studio (or just list the new hex/size/spacing values). The developer pastes them into `tokens.css` → the app reskins. Nothing else changes.
2. **Per-screen / per-component redlines** — Figma frames + notes ("this card: radius 4px, no shadow, 20px padding"). The developer applies them to the matching `.css` file.

Either way the developer applies visual changes to `.css` only and **never edits a `.jsx` file for a reskin**, so every button, form, payment, and check-in keeps working exactly as it does now. There's a full automated test suite (185 tests) that will catch anything that somehow reaches behaviour.

---

## Component & screen file map (for redlines)

**Components** (`src/ui/`): `Button` `HoldButton` `Input` `SearchField` `Pill` `Chip` `DomainToggle` `Card` `Ticket` `StatTile` `Banner` `Toast` `Sheet` `Drawer` `Dialog` `ConfirmSheet` `ConfirmPopover` `QRPanel` `ResultRow` `TableRow` `EmptyState` `Skeleton` `PresenceDot` `Avatar` `TopBar` `ActionBar` `Accordion` `Stamp` `SpectrumDots` `CelebrationCheck` `OfflineBanner` — each has `<Name>.css`.

**Interviewer screens** (`src/screens/interviewer/`): `Login` · `Search` · `Candidate` · `Payment` · `Done` · `Chrome` (the top bar) — each has `<Name>.css`.

**Check-in desk** (`src/screens/desk/`): `Desk.css`.

**Admin** : `src/AdminPortal.css` + `src/screens/admin/` (`AdminLogin` `AdminTopBar` `AdminStats` `AdminCandidatesTable` `AdminCandidateDrawer` `AdminInterviewers` `AdminActivity`).
