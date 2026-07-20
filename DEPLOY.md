# Deploying MAFIA

**Two versions, ONE shared Firestore** (`mafia-recruitments`). There is a single
backend — v1 and v2 read and write the same live data.

- **v2** — the redesign, the real app → `mafia-recruitments.web.app`
- **v1** — a *frozen* pre-redesign copy, for visual comparison only →
  `mafia-old.web.app`. Keep users off it. Its old code still contains the
  removed `/setup` admin-password page and the payment stub, so:
  **rotate the admin account's password in Firebase first** — that kills v1's
  `/setup` backdoor (it hard-codes the old password) while leaving the page
  visible for comparison.

Deploying is a manual step (needs your Firebase CLI login). Nothing auto-deploys.

---

## v2 — the live app

```sh
npm run build
firebase deploy --only hosting,firestore:rules
```

`firestore:rules` matters when the check-in-desk anonymous rules land (Stage D
of the corrections batch) — deploy them together with the app.

---

## v1 — the frozen comparison copy

**One-time** — create the second hosting site:

```sh
firebase hosting:sites:create mafia-old
```

**Build the old version from its tag, isolated in a git worktree** (so your
main checkout is never disturbed), into `build-v1`:

```sh
git worktree add ../mafia-v1 v1-pre-redesign
( cd ../mafia-v1 && npm install && BUILD_PATH="$PWD/../mafia-dashboard/build-v1" npm run build )
# If that react-scripts version ignores BUILD_PATH, fall back to:
#   ( cd ../mafia-v1 && npm install && npm run build ) && rm -rf build-v1 && cp -r ../mafia-v1/build build-v1
firebase deploy --only hosting --config firebase-v1.json
git worktree remove ../mafia-v1
```

`firebase-v1.json` points at the `mafia-old` site and serves `build-v1/`. Your
normal `firebase.json` is untouched, so the v2 deploy above keeps working.

v1 is frozen — you only re-run this if you ever want to refresh the comparison
copy, which you normally won't.

---

## Notes

- `build-v1/` is a local artifact — add it to `.gitignore` if you don't want it
  tracked (it's regenerated from the `v1-pre-redesign` tag anytime).
- The exact `firebase` CLI flags can vary by `firebase-tools` version; if
  anything errors, check `firebase --version` and the site name.
