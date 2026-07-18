import React, { useEffect, useState } from "react";
import { Avatar, Button, Sheet, Ticket, TopBar } from "../../ui";
import "./Chrome.css";

/**
 * InterviewerChrome — the §6 global chrome for all signed-in screens.
 * 48 px TopBar (interviewer variant): text wordmark left — or, on
 * candidate/payment, a back chevron + condensed ticket; right: connection
 * dot (navigator.onLine → green "Synced" / amber "Offline") + 32 px
 * initials Avatar opening the account bottom Sheet (email, mono tel: help,
 * Sign out — NO counters, §2 #34). Presentational: auth/session logic stays
 * in App.js.
 */
export default function InterviewerChrome({
  user,
  isOnline = true,
  onSignOut,
  onBack,
  ticket = null,
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <TopBar
        variant="interviewer"
        onBack={onBack}
        left={
          onBack && ticket ? (
            <Ticket condensed name={ticket.name} regNo={ticket.regNo} />
          ) : undefined
        }
        right={
          <>
            <span
              className={
                "iv-conn " + (isOnline ? "iv-conn--online" : "iv-conn--offline")
              }
              role="status"
            >
              <span className="iv-conn__dot" aria-hidden="true" />
              <span className="iv-conn__label">
                {isOnline ? "Synced" : "Offline"}
              </span>
            </span>
            <button
              type="button"
              className="iv-chrome__avatar-btn"
              aria-label="Account"
              onClick={() => setAccountOpen(true)}
            >
              <Avatar name={user?.displayName || user?.email} size={32} />
            </button>
          </>
        }
      />
      <Sheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Account"
      >
        <div className="iv-account">
          <div className="iv-account__email">{user?.email}</div>
          <a className="iv-account__help" href="tel:9591185310">
            Help: 9591185310
          </a>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            destructive
            onClick={() => {
              setAccountOpen(false);
              if (onSignOut) onSignOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/**
 * ScreenEnter — §9.1 screen-transition wrapper for the state machine:
 * the incoming screen translates 12 px → 0 and fades in over
 * --motion-screen. Two-phase class flip via transitions (no keyframes);
 * reduced motion collapses to opacity <= 80 ms via the base.css block.
 * Re-runs whenever `id` (the screen name) changes.
 */
export function ScreenEnter({ id, children }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [id]);

  return (
    <div className={"iv-screen" + (entered ? " iv-screen--in" : "")}>
      {children}
    </div>
  );
}
