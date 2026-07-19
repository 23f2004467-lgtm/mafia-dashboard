import React, { useEffect, useState } from "react";
import { Avatar, Button, OfflineBanner, Sheet, Ticket, TopBar } from "../../ui";
import "./Chrome.css";

/**
 * InterviewerChrome — the §6 global chrome for all signed-in screens.
 * 48 px TopBar (interviewer variant): text wordmark left — or, on
 * candidate/payment, a back chevron; right: connection
 * dot (navigator.onLine → green "Synced" / amber "Offline") + 32 px
 * initials Avatar opening the account bottom Sheet (email, mono tel: help,
 * Sign out — NO counters, §2 #34).
 *
 * Ticket dedup: the condensed identity (name + regNo) renders in the bar
 * ONLY while the screen's main Ticket ([data-iv-ticket]) is scrolled out
 * of view — an IntersectionObserver drives a 120 ms opacity/transform
 * swap (spring entrance, --ease exit). Screens without a main Ticket
 * (Payment) always show the identity. Offline additionally shows the thin
 * amber OfflineBanner ("Offline — changes will sync") under the bar on
 * every signed-in screen. `pendingPayment` ({name, onOpen}) renders
 * the amber "₹ pending · {name}" chip when a payment session is live away
 * from the Payment screen (§6.4 — tap returns to it). Presentational:
 * auth/session logic stays in App.js.
 */
export default function InterviewerChrome({
  user,
  isOnline = true,
  onSignOut,
  onBack,
  ticket = null,
  pendingPayment = null,
  stage = false,
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  // Ticket dedup: identity appears in the bar only once the main Ticket
  // ([data-iv-ticket], rendered by the screen) has scrolled out of view.
  // `ticket` is a fresh object each App render, so this re-arms on every
  // screen/data change — cheap, and it re-resolves the sentinel after
  // screen swaps (Payment has none → identity always shown there).
  const [ticketAway, setTicketAway] = useState(false);
  useEffect(() => {
    if (!ticket) {
      setTicketAway(false);
      return undefined;
    }
    const sentinel = document.querySelector("[data-iv-ticket]");
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      setTicketAway(true); // no main Ticket on this screen → bar carries it
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setTicketAway(!entry.isIntersecting),
      { rootMargin: "-48px 0px 0px 0px" } // out of view = under the 48px bar
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [ticket]);

  return (
    <>
      <TopBar
        variant="interviewer"
        stage={stage}
        onBack={onBack}
        left={
          onBack && ticket ? (
            <span
              className={
                "iv-chrome__ticket" + (ticketAway ? " is-in" : "")
              }
              aria-hidden={!ticketAway}
            >
              <Ticket condensed name={ticket.name} regNo={ticket.regNo} />
            </span>
          ) : undefined
        }
        right={
          <>
            {pendingPayment ? (
              <button
                type="button"
                className="iv-pending-chip"
                onClick={pendingPayment.onOpen}
              >
                <span className="iv-pending-chip__pill">
                  ₹ pending · {pendingPayment.name}
                </span>
              </button>
            ) : null}
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
      {!isOnline ? <OfflineBanner /> : null}
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
    <div
      className={
        "iv-screen iv-screen--" + id + (entered ? " iv-screen--in" : "")
      }
    >
      {children}
    </div>
  );
}
