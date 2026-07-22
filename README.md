# MAFIA Recruitment Dashboard

**Live:** https://mafia-recruitments.web.app

The recruitment tool for **MAFIA — the Music and Fine Arts Club** (MIT Manipal). It runs the club's annual auditions: ~600 candidates interviewed over a few days by 30+ student interviewers working at once, plus a small board overseeing it all and collecting the membership fee. It replaced a chaotic pile of Google Forms and Excel sheets with one live, real-time app.

Built with **React + Firebase (Firestore, Auth, Hosting)**. Everything syncs in real time — a change on one phone shows up on every other instantly.

---

## Who uses it (three roles, one app)

| Role | Signs in with | Their job |
|---|---|---|
| **Interviewer** | Google (college account) | Find a candidate → read their preferences & questions → record a verdict (which committees selected them, or *not selected*) → if selected, show a payment QR or take cash and confirm it |
| **Board / Admin** | Email + password | Watch everything live: who's checked in, who's paid, verify payments against the club account, monitor interviewer activity, export to Excel, manage the desk |
| **Check-in desk** | Name + a shared code | Call candidates by their time slot and mark them present as they arrive — nothing else |

**The flow:** register → checked in at the desk → interviewed (verdict recorded) → if selected, pays ₹300 (interviewer confirms it) → board verifies the payment → member.

A core idea: **interviewers *claim* a payment, only the board makes it *true*.** That amber-to-green gap is where the old cash-leakage problem lived.

---

## Quick start

```bash
npm install
npm start          # dev server → http://localhost:3000
```

The Firebase project config is baked into `src/firebaseConfig.js` (the web API key is not a secret — access is controlled by Firestore security rules), so it connects to the live backend out of the box. No `.env` needed to run.

```bash
npm test           # 185 tests (CI=true npm test -- --watchAll=false to run once)
npm run build      # production bundle → build/
firebase deploy --only hosting     # publish build/ to the live site (needs `firebase login`)
```

**Note:** `firebase deploy` uploads your local `build/` folder straight to Firebase — it does **not** deploy from GitHub. GitHub is just the source backup.

---

## Design

The whole look is the **"House Lights"** design system — bright warm-paper working screens (readable on a phone under venue glare), a dark violet "stage" for the admin board and the login, the club's own drone footage and jacket-violet brand throughout.

- **[`DESIGN.md`](DESIGN.md)** — the complete design system as shipped: tokens, typography, the candidate-state colour language, motion, accessibility.
- **[`design-handoff/`](design-handoff/)** — everything a Figma designer needs to redesign the look *without touching functionality*: the tokens as an importable Figma file (`mafia-tokens.json`) and a guide (`HANDOFF.md`).

The app is built so the **look** (CSS tokens + per-component CSS) and the **behaviour** (`.jsx` files) live apart — you can reskin it entirely by changing token values, and the functionality can't break.

---

## Project structure

```
src/
  App.js                 interviewer + desk logic, routing, all Firebase reads/writes
  AdminPortal.jsx        admin logic + Firebase
  firebaseConfig.js      Firebase init
  candidateState.js      the single source of truth for candidate-state pills (§5)
  ui/                    the component library (Button, Pill, Ticket, Sheet, …) + tokens.css + base.css
  screens/
    interviewer/         Login, Search, Candidate, Payment, Done, Chrome (presentational)
    desk/                the check-in desk screen
    admin/               admin login, stats, table, drawer, interviewers, activity
  content/questions.js   interview questions per domain (placeholder — board fills in)
  __fixtures__/          Jest fixtures that guard the Firestore payload & Excel export byte-for-byte
firestore.rules          Firestore security rules
DESIGN.md                the design system
REDESIGN_PROMPT.md       the original redesign spec (historical)
design-handoff/          Figma designer package
CLAUDE.md                guide for AI agents working on this codebase
```

---

## Still to do (owner actions)

- **Enable Anonymous sign-in** in the Firebase console (Authentication → Sign-in method) — activates the check-in desk's name+code login.
- **Deploy the Firestore rules:** `firebase deploy --only firestore:rules` — enforces that a desk session can only write check-in fields.
- **Rotate the old admin password** if the pre-redesign account is still in use (the old `/setup` page hardcoded it; it's gone from the current code but lives in old git history).
- Feed the parser a real **time-slot Excel** and, later, **bank statements** (for the planned statement-reconciliation feature).

---

*Built for MAFIA, MIT Manipal. Contact: [dheera1312@gmail.com](mailto:dheera1312@gmail.com) · 9591185310.*
