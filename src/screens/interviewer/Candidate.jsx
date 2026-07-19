import React, { useState } from "react";
import {
  Accordion,
  ActionBar,
  Banner,
  Button,
  Card,
  Chip,
  DomainToggle,
  Input,
  Pill,
  Select,
  Sheet,
  Textarea,
  Ticket,
} from "../../ui";
import questions from "../../content/questions";
import "./Candidate.css";

/**
 * Candidate — §6.3, one scrolling screen, sticky top and bottom.
 * Presentational: all Firebase writes, validation and the verdict state
 * live in App.js; this screen renders formData and reports intents.
 *
 * - Full Ticket (standard / walk-in) in flow at the top, tagged
 *   [data-iv-ticket]: the Chrome TopBar watches it with an
 *   IntersectionObserver and carries the condensed identity ONLY while
 *   it is scrolled out of view (ticket dedup — never both at once).
 * - Zones sit on sunken panels with caps micro-label header rows; the
 *   white rows/cards inside lift off the panels.
 * - Zone A details definition list; ghost "Edit details"
 *   flips name/year/college/branch/WhatsApp to Inputs. regNo NEVER editable
 *   (§2 #23) — walk-ins have it locked post-generation too.
 * - Zone B preferences: ranked chips (walk-in mode: editable Inputs, since
 *   §6.6 makes all fields editable in create mode).
 * - Zone C questions: collapsed Accordions from src/content/questions.js
 *   keyed by the candidate's preferred domains.
 * - Zone D verdict: per-committee DomainToggle groups mapping to the
 *   existing verdict arrays; "Not selected — no committees" negative row
 *   with the §2 #10 inline confirm-on-clear.
 * - Zone E comments: 4-row Textarea + "Insert template" chip.
 * - Sticky ActionBar: primary disabled-with-reason until a verdict exists;
 *   "⋯" overflow → Clear / Cancel (Sheet).
 */

/** §5 Track 2 — payment pill state from existing paid/manuallyVerified. */
const derivePaymentState = (cand) =>
  cand && cand.paid
    ? cand.manuallyVerified
      ? "verified"
      : "paid_unverified"
    : "unpaid";

const TALENT_DOMAINS = ["Dance", "Music", "Art"];

/** §6.3 Zone D: short display labels; VALUES are the exact strings the
 *  existing verdict arrays carry (write shape untouched). */
const WORK_DOMAINS = [
  { value: "Human Resources", label: "HR" },
  { value: "Public Relations", label: "PR" },
  { value: "Social Media and Graphic Design", label: "SM&GD" },
  { value: "Photography and Videography", label: "P&V" },
];

/** Free-text preference → src/content/questions.js domain key. */
const domainKeyFor = (pref) => {
  const t = (pref || "").toLowerCase();
  if (!t) return null;
  if (t.includes("dance")) return "dance";
  if (t.includes("music")) return "music";
  if (t.includes("social") || t.includes("graphic") || t.includes("smgd"))
    return "smgd";
  if (t.includes("photo") || t.includes("video") || t.trim() === "pv")
    return "pv";
  if (t.includes("art")) return "art";
  if (t.includes("human") || t.trim() === "hr") return "hr";
  if (t.includes("public") || t.trim() === "pr") return "pr";
  return null;
};

const DOMAIN_TITLES = {
  dance: "Dance",
  music: "Music",
  art: "Art",
  hr: "HR",
  pr: "PR",
  smgd: "SM&GD",
  pv: "P&V",
};

const COMMENT_TEMPLATE =
  "STRENGTHS:\n\nWEAKNESSES:\n\nOBSERVATIONS:\n\nRECOMMENDATION:\n";

const isFirstYear = (year) => year === "1st Year" || year === "1st year";

export default function Candidate({
  formData,
  isWalkIn = false,
  notSelected = false,
  errors = null,
  submitting = false,
  onChangeField,
  onChangeYear,
  onChangePreference,
  onToggleDomain,
  onMarkNotSelected,
  onUnmarkNotSelected,
  onChangeComments,
  onSubmit,
  onClear,
  onCancel,
}) {
  // §6.3 Zone A: read-only details until "Edit details"; walk-ins are
  // always in edit mode (§6.6 create mode: all fields editable).
  const [editing, setEditing] = useState(false);
  const editMode = isWalkIn || editing;

  // §2 #10 inline confirm-on-clear for the negative verdict row.
  const [confirmClear, setConfirmClear] = useState(false);

  // "⋯" overflow → Clear / Cancel.
  const [menuOpen, setMenuOpen] = useState(false);

  const verdict = formData.verdict || {};
  const talentSelected = Array.isArray(verdict.talentComm)
    ? verdict.talentComm
    : [];
  const workSelected = Array.isArray(verdict.workComm) ? verdict.workComm : [];
  const domainCount = talentSelected.length + workSelected.length;
  const verdictValid = notSelected || domainCount > 0;

  const firstYear = isFirstYear(formData.year);
  const prefs = formData.preferences || {};
  const talentPrefs = [
    prefs.talentComm?.pref1,
    prefs.talentComm?.pref2,
  ].filter(Boolean);
  const workPrefs = [
    prefs.workComm?.pref1,
    prefs.workComm?.pref2,
    prefs.workComm?.pref3,
  ].filter(Boolean);

  // Zone C: question accordions keyed by the candidate's preferred domains.
  const preferredKeys = [];
  [...talentPrefs, ...(firstYear ? workPrefs : [])].forEach((p) => {
    const key = domainKeyFor(p);
    if (key && questions[key] && !preferredKeys.includes(key)) {
      preferredKeys.push(key);
    }
  });

  const journeyState = notSelected
    ? "not_selected"
    : domainCount > 0
    ? "selected"
    : "checked_in";

  const errorList = errors ? Object.values(errors) : [];
  const fieldError = (key) => (errors ? errors[key] : undefined);

  const handleDomainTap = (type, domain) => {
    setConfirmClear(false);
    onToggleDomain(type, domain);
  };

  const handleNotSelectedTap = () => {
    if (notSelected) {
      onUnmarkNotSelected();
      setConfirmClear(false);
      return;
    }
    if (domainCount > 0) {
      setConfirmClear(true); // §2 #10: never a silent clear
      return;
    }
    onMarkNotSelected();
  };

  const insertTemplate = () => {
    const current = formData.comments || "";
    onChangeComments(
      current.trim().length > 0 ? `${current}\n\n${COMMENT_TEMPLATE}` : COMMENT_TEMPLATE
    );
  };

  // Owner ask (2026-07-20): Insert template deserves a counterpart.
  // Clears the whole comments field — it is just the textarea value, so
  // typing again (or Insert template) rebuilds it; no confirm needed.
  const clearComments = () => onChangeComments("");

  const ticketPills = (
    <>
      <Pill track="journey" state={journeyState} size="sm" />
      <Pill track="payment" state={derivePaymentState(formData)} size="sm" />
    </>
  );

  const displayName = formData.name || (isWalkIn ? "New walk-in" : "");

  // Chosen-domain labels for the ActionBar summary line (short display
  // labels for WorkComm; the verdict arrays keep their exact strings).
  const chosenLabels = [
    ...talentSelected,
    ...workSelected.map(
      (v) => (WORK_DOMAINS.find((w) => w.value === v) || { label: v }).label
    ),
  ];
  const verdictSummary = notSelected
    ? "Not selected"
    : domainCount > 0
    ? `Selected · ${chosenLabels.join(" + ")}`
    : undefined;

  return (
    <div className="iv-cand">
      {/* ---------- The full Ticket (§6.3 / §11.2) ----------
          [data-iv-ticket]: the Chrome TopBar's IntersectionObserver
          sentinel — the condensed bar identity appears only once this
          scrolls out of view (ticket dedup). */}
      <div className="iv-cand__ticket" data-iv-ticket="">
        <Ticket
          name={displayName}
          regNo={formData.regNo}
          yearChip={formData.year || null}
          pills={ticketPills}
          variant={isWalkIn ? "walkin" : "standard"}
        />
      </div>

      {/* ---------- Zone A — Details ---------- */}
      <section className="iv-cand__zone" aria-label="Details">
        <div className="iv-cand__zone-head">
          <h2 className="iv-cand__micro-label">Details</h2>
        </div>
        {editMode ? (
          <Card className="iv-cand__details iv-cand__details--edit">
            <Input
              label={isWalkIn ? "Name *" : "Name"}
              value={formData.name}
              error={fieldError("name")}
              onChange={(e) => onChangeField("name", e.target.value)}
              placeholder={isWalkIn ? "Candidate's full name" : undefined}
            />
            <Select
              label={isWalkIn ? "Academic year *" : "Academic year"}
              value={formData.year}
              error={fieldError("year")}
              onChange={(e) => onChangeYear(e.target.value)}
            >
              <option value="">Select academic year</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </Select>
            <Input
              label={isWalkIn ? "College *" : "College"}
              value={formData.college}
              error={fieldError("college")}
              onChange={(e) => onChangeField("college", e.target.value)}
            />
            <Input
              label={isWalkIn ? "Branch *" : "Branch"}
              value={formData.branch}
              error={fieldError("branch")}
              onChange={(e) => onChangeField("branch", e.target.value)}
            />
            <Input
              label={isWalkIn ? "WhatsApp number *" : "WhatsApp number"}
              value={formData.whatsappNumber}
              error={fieldError("whatsappNumber")}
              mono
              inputMode="tel"
              onChange={(e) => onChangeField("whatsappNumber", e.target.value)}
              placeholder={isWalkIn ? "10-digit WhatsApp number" : undefined}
            />
            {isWalkIn ? (
              <p className="iv-cand__walkin-note">
                Required: name, year, college, branch, WhatsApp. 1st year:
                TalentComm + WorkComm preferences. 2nd year: TalentComm only.
                Reg number is temporary and locked.
              </p>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Done editing
              </Button>
            )}
          </Card>
        ) : (
          <Card className="iv-cand__details">
            <dl className="iv-cand__dl">
              <div className="iv-cand__dl-row">
                <dt>Year</dt>
                <dd>{formData.year || "—"}</dd>
              </div>
              <div className="iv-cand__dl-row">
                <dt>College</dt>
                <dd>{formData.college || "—"}</dd>
              </div>
              <div className="iv-cand__dl-row">
                <dt>Branch</dt>
                <dd>{formData.branch || "—"}</dd>
              </div>
              <div className="iv-cand__dl-row">
                <dt>WhatsApp</dt>
                <dd className="iv-cand__mono">
                  {formData.whatsappNumber || "—"}
                </dd>
              </div>
            </dl>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          </Card>
        )}
      </section>

      {/* ---------- Zone B — Preferences ---------- */}
      <section className="iv-cand__zone" aria-label="Preferences">
        <div className="iv-cand__zone-head">
          <h2 className="iv-cand__micro-label">Preferences</h2>
          <span className="iv-cand__zone-helper">ranked by candidate</span>
        </div>
        {isWalkIn ? (
          <div className="iv-cand__pref-edit">
            <Input
              label="TalentComm preference 1 *"
              value={prefs.talentComm?.pref1 || ""}
              error={fieldError("talentPref1")}
              onChange={(e) =>
                onChangePreference("talentComm", "pref1", e.target.value)
              }
            />
            <Input
              label="TalentComm preference 2"
              value={prefs.talentComm?.pref2 || ""}
              onChange={(e) =>
                onChangePreference("talentComm", "pref2", e.target.value)
              }
            />
            {firstYear ? (
              <>
                <Input
                  label="WorkComm preference 1 *"
                  value={prefs.workComm?.pref1 || ""}
                  error={fieldError("workPref1")}
                  onChange={(e) =>
                    onChangePreference("workComm", "pref1", e.target.value)
                  }
                />
                <Input
                  label="WorkComm preference 2"
                  value={prefs.workComm?.pref2 || ""}
                  onChange={(e) =>
                    onChangePreference("workComm", "pref2", e.target.value)
                  }
                />
                <Input
                  label="WorkComm preference 3 (optional)"
                  value={prefs.workComm?.pref3 || ""}
                  onChange={(e) =>
                    onChangePreference("workComm", "pref3", e.target.value)
                  }
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className="iv-cand__pref-rows">
            <div className="iv-cand__pref-row">
              <span className="iv-cand__pref-comm">TalentComm</span>
              <span className="iv-cand__pref-chips">
                {talentPrefs.length > 0 ? (
                  talentPrefs.map((p, i) => (
                    <Chip key={`t${i}`} rank={i + 1}>
                      {p}
                    </Chip>
                  ))
                ) : (
                  <span className="iv-cand__pref-none">—</span>
                )}
              </span>
            </div>
            {/* WorkComm row only for 1st years (existing year-gate logic) */}
            {firstYear ? (
              <div className="iv-cand__pref-row">
                <span className="iv-cand__pref-comm">WorkComm</span>
                <span className="iv-cand__pref-chips">
                  {workPrefs.length > 0 ? (
                    workPrefs.map((p, i) => (
                      <Chip key={`w${i}`} rank={i + 1}>
                        {p}
                      </Chip>
                    ))
                  ) : (
                    <span className="iv-cand__pref-none">—</span>
                  )}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* ---------- Zone C — Questions ---------- */}
      {preferredKeys.length > 0 ? (
        <section className="iv-cand__zone" aria-label="Questions">
          <div className="iv-cand__zone-head">
            <h2 className="iv-cand__micro-label">Questions</h2>
            <span className="iv-cand__zone-helper">
              from their preferred domains
            </span>
          </div>
          <div className="iv-cand__questions">
            {preferredKeys.map((key) => (
              <Accordion key={key} title={DOMAIN_TITLES[key]}>
                <ol className="iv-cand__question-list">
                  {questions[key].map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </Accordion>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------- Zone D — Verdict ---------- */}
      <section className="iv-cand__zone" aria-label="Verdict">
        <div className="iv-cand__zone-head">
          <h2 className="iv-cand__micro-label">Verdict</h2>
          <span className="iv-cand__zone-helper">
            tap every selected domain
          </span>
        </div>
        <div className="iv-cand__verdict-group">
          <div className="iv-cand__group-head">
            <h3 className="iv-cand__group-label">TalentComm</h3>
            {talentSelected.length > 0 ? (
              <span className="iv-cand__group-count">
                {talentSelected.length} selected
              </span>
            ) : null}
          </div>
          <div className="iv-cand__toggles">
            {TALENT_DOMAINS.map((domain) => (
              <DomainToggle
                key={domain}
                label={domain}
                on={talentSelected.includes(domain)}
                onToggle={() => handleDomainTap("talentComm", domain)}
              />
            ))}
          </div>
        </div>
        {firstYear ? (
          <div className="iv-cand__verdict-group">
            <div className="iv-cand__group-head">
              <h3 className="iv-cand__group-label">WorkComm</h3>
              {workSelected.length > 0 ? (
                <span className="iv-cand__group-count">
                  {workSelected.length} selected
                </span>
              ) : null}
            </div>
            <div className="iv-cand__toggles">
              {WORK_DOMAINS.map(({ value, label }) => (
                <DomainToggle
                  key={value}
                  label={label}
                  on={workSelected.includes(value)}
                  onToggle={() => handleDomainTap("workComm", value)}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="iv-cand__verdict-group iv-cand__verdict-group--negative">
          <DomainToggle
            negative
            label="Not selected — no committees"
            on={notSelected}
            onToggle={handleNotSelectedTap}
          />
          {confirmClear ? (
            <div className="iv-cand__clear-confirm" role="alert">
              <span className="iv-cand__clear-question">
                Clear {domainCount} selected domain
                {domainCount === 1 ? "" : "s"}?
              </span>
              <span className="iv-cand__clear-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  destructive
                  onClick={() => {
                    onMarkNotSelected();
                    setConfirmClear(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                >
                  Keep
                </Button>
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- Zone E — Comments ---------- */}
      <section className="iv-cand__zone" aria-label="Comments">
        <div className="iv-cand__zone-head">
          <h2 className="iv-cand__micro-label">Comments</h2>
        </div>
        <Textarea
          className="iv-cand__comments"
          label="Comments"
          rows={4}
          value={formData.comments}
          error={fieldError("comments")}
          onChange={(e) => onChangeComments(e.target.value)}
          placeholder="Notes about their talent…"
        />
        <div className="iv-cand__template">
          <Chip onToggle={insertTemplate}>Insert template</Chip>
          {(formData.comments || "").trim().length > 0 ? (
            <Chip onToggle={clearComments}>Clear</Chip>
          ) : null}
        </div>
      </section>

      {errorList.length > 0 ? (
        <div className="iv-cand__errors">
          <Banner tone="error">
            <ul className="iv-cand__error-list">
              {errorList.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </Banner>
        </div>
      ) : null}

      {/* ---------- Sticky ActionBar ---------- */}
      <ActionBar busy={submitting} onOverflow={() => setMenuOpen(true)}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!verdictValid}
          disabledReason="Pick domains or Not selected"
          sub={verdictSummary}
          onClick={onSubmit}
        >
          {isWalkIn ? "Save walk-in" : "Submit verdict"}
        </Button>
      </ActionBar>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Options">
        <div className="iv-cand__menu">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            destructive
            onClick={() => {
              setMenuOpen(false);
              onClear();
            }}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => {
              setMenuOpen(false);
              onCancel();
            }}
          >
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
