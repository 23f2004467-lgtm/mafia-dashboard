import React, { useEffect, useState } from "react";
import { Banner, Button, SpectrumDots } from "../../ui";
import "./Login.css";

/**
 * Login (§6.1) — the interviewer portal's one full-brand stage moment.
 * Presentational only: auth lives in App.js and arrives via props.
 *
 * Two modes:
 * - `booting` — the boot splash shown while onAuthStateChanged resolves on
 *   cold load: the same black stage with the §9.4 six-dot spectrum loader in
 *   place of the lettering; after 2 s a "Signing in…" label and the mono help
 *   line appear (never indefinite bare black in a bright room). Restored
 *   sessions go splash → Search and never see the sign-in form.
 * - default — the sign-in stage: "MAFIA" display wordmark, static spectrum
 *   dot row, showbill lettering (mix-blend-mode: screen over the pure-black
 *   stage), one 56 px primary "Continue with Google", mono tel: help link.
 *   Errors render as an inline error Banner (mapped copy from App.js's
 *   existing error table) — never alert().
 */
export default function Login({
  booting = false,
  onLogin,
  loading = false,
  error = "",
}) {
  const [slowBoot, setSlowBoot] = useState(false);

  useEffect(() => {
    if (!booting) {
      setSlowBoot(false);
      return undefined;
    }
    const t = setTimeout(() => setSlowBoot(true), 2000);
    return () => clearTimeout(t);
  }, [booting]);

  return (
    <div className="iv-login" data-theme="dark">
      <div className="iv-login__glow" aria-hidden="true" />
      <main className="iv-login__column">
        <h1 className="iv-login__wordmark">MAFIA</h1>
        <SpectrumDots
          size={booting ? 8 : 6}
          loading={booting}
          label="Loading"
        />
        {booting ? (
          slowBoot ? (
            <>
              <p className="iv-login__tagline">Signing in…</p>
              <a className="iv-login__help" href="tel:9591185310">
                Help: 9591185310
              </a>
            </>
          ) : null
        ) : (
          <>
            <img
              className="iv-login__lettering"
              src="/brand/showbill-lettering.png"
              alt="The Music and Fine Arts Club"
              width="280"
            />
            <p className="iv-login__tagline">
              Recruitment interviews · 2025–26
            </p>
            <div className="iv-login__cta">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                onClick={onLogin}
              >
                Continue with Google
              </Button>
            </div>
            {error ? (
              <div className="iv-login__error">
                <Banner tone="error">{error}</Banner>
              </div>
            ) : null}
            <a className="iv-login__help" href="tel:9591185310">
              Help: 9591185310
            </a>
          </>
        )}
      </main>
    </div>
  );
}
