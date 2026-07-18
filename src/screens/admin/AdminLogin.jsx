import React, { useEffect, useState } from "react";
import { Banner, Button, Card, Input } from "../../ui";
import "./AdminLogin.css";

/**
 * AdminLogin (§7.1) — presentational dark login card.
 *
 * ALL auth logic (rate limit, lockout, audit, Firebase sign-in) stays in
 * AdminPortal.jsx. This screen renders its state and formats the ticking
 * countdown from `error.until` — every number on screen is derived
 * upstream from SECURITY_CONFIG / the rate-limit call, never restated.
 *
 * error: null | {
 *   kind: 'missing' | 'rate' | 'lockout' | 'failed',
 *   message?,    // failed: auth error text
 *   remaining?,  // failed: attempts left (derived from SECURITY_CONFIG)
 *   until?,      // rate/lockout: epoch ms when the gate lifts
 * }
 */

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AdminLogin({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  isLoggingIn,
  error,
  onErrorExpired,
}) {
  // 1 s tick while a deadline-bearing error shows; auto-clears at zero so
  // the admin is never told to wait past the gate the logic enforces.
  const until = error && error.until ? error.until : null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!until) return undefined;
    const iv = setInterval(() => {
      if (Date.now() >= until) {
        if (onErrorExpired) onErrorExpired();
      } else {
        setTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [until, onErrorExpired]);

  let banner = null;
  if (error) {
    if (error.kind === "missing") {
      banner = <Banner tone="error">Enter both email and password.</Banner>;
    } else if (error.kind === "rate" || error.kind === "lockout") {
      banner = (
        <Banner tone="error">
          {error.kind === "rate"
            ? "Too many sign-in attempts."
            : "Admin access is temporarily locked."}{" "}
          <span className="admin-login__countdown">
            Try again in {formatCountdown(until - Date.now())}
          </span>
        </Banner>
      );
    } else {
      banner = (
        <Banner tone="error">
          <div>{error.message || "Sign-in failed."}</div>
          {typeof error.remaining === "number" ? (
            <div className="admin-login__remaining">
              {error.remaining === 1
                ? "1 attempt remaining"
                : `${error.remaining} attempts remaining`}
            </div>
          ) : null}
        </Banner>
      );
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__column">
        <img
          className="admin-login__lockup"
          src="/brand/wordmark-white.png"
          alt="MAFIA"
        />
        <Card as="section" className="admin-login__card">
          <div className="admin-login__microlabel">Admin · Recruitment 25–26</div>
          <form
            className="admin-login__form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              autoComplete="username"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              autoComplete="current-password"
            />
            <Button type="submit" size="md" fullWidth loading={isLoggingIn}>
              Sign in as admin
            </Button>
          </form>
          {banner ? <div className="admin-login__error">{banner}</div> : null}
          <div className="admin-login__help">
            Help:{" "}
            <a className="admin-login__tel" href="tel:9591185310">
              9591185310
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
