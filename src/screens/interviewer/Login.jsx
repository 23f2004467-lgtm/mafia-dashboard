import React, { useEffect, useState } from "react";
import { Banner, Button, SpectrumDots } from "../../ui";
import "./Login.css";

/**
 * Login (§6.1) — the interviewer portal's one full-brand stage moment.
 * Presentational only: auth lives in App.js and arrives via props.
 *
 * The foreground is a cinematic title card: a bounded playbill panel
 * (translucent stage ink, 1px border, ticket corners, the §2 #50
 * six-segment spectrum hairline as its top edge) framing an event
 * billing — presenter line with flanking rules ("The Music and Fine
 * Arts Club"), the MAFIA marquee (Bakbak One, marquee scale), the
 * six-dot lockup row beneath it (MAFIA-06 proportions), the season
 * billing line, the 56px Google CTA on the panel grid, and the mono
 * help line as the footer credit. One-shot entrance: panel fades up,
 * then lines fade up staggered (--motion-micro base + i × --stagger;
 * transitions only, no keyframes; reduced motion collapses via the
 * base.css global block). Nothing loops.
 *
 * Two modes:
 * - `booting` — the boot splash shown while onAuthStateChanged resolves
 *   on cold load: the SAME panel and lockup with the §9.4 six-dot
 *   spectrum loader in the dot row's seat; after 2 s a "Signing in…"
 *   billing line and the footer credit appear (never indefinite bare
 *   black in a bright room). Restored sessions go splash → Search and
 *   never see the sign-in form — the panel never re-animates, so
 *   splash → login is a content swap inside one continuous card.
 * - default — the sign-in card: billing, marquee, dots, season line,
 *   one 56px primary "Continue with Google", mono tel: help credit.
 *   Errors render as an inline error Banner (mapped copy from App.js's
 *   existing error table) — never a native dialog.
 */
export default function Login({
  booting = false,
  onLogin,
  loading = false,
  error = "",
}) {
  const [slowBoot, setSlowBoot] = useState(false);

  // The drone flight plays only where it earns its bytes: >= 768px and no
  // reduced-motion preference. Phones and reduced-motion get the graded
  // Cadenza still (also the video's poster) — same scene, zero cost.
  const [useVideo, setUseVideo] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setUseVideo(wide && !reduced);
  }, []);

  useEffect(() => {
    if (!booting) {
      setSlowBoot(false);
      return undefined;
    }
    const t = setTimeout(() => setSlowBoot(true), 2000);
    return () => clearTimeout(t);
  }, [booting]);

  // One-shot title-card entrance (§9.1 two-phase class flip, same as
  // ScreenEnter): runs on mount only, never on the boot → login swap.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Per-line entrance delay (§9.2 stagger law; delay set inline like
  // Search's result rows). Lines mounted after entry appear in place.
  const lineDelay = (i) => ({
    transitionDelay: `calc(var(--motion-micro) + ${i} * var(--stagger))`,
  });

  return (
    <div
      className={"iv-login" + (entered ? " iv-login--in" : "")}
      data-theme="dark"
    >
      <div className="iv-login__stage" aria-hidden="true">
        {useVideo ? (
          <video
            src="/brand/login-stage.mp4"
            poster="/brand/login-stage-a.jpg"
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
          />
        ) : (
          <img src="/brand/login-stage-a.jpg" alt="" draggable={false} />
        )}
      </div>
      <div className="iv-login__glow" aria-hidden="true" />
      <main className="iv-login__column">
        <section className="iv-login__panel" aria-label="Sign in">
          <div className="iv-login__hairline" aria-hidden="true">
            <span className="iv-login__hairline-seg iv-login__hairline-seg--red" />
            <span className="iv-login__hairline-seg iv-login__hairline-seg--orange" />
            <span className="iv-login__hairline-seg iv-login__hairline-seg--amber" />
            <span className="iv-login__hairline-seg iv-login__hairline-seg--green" />
            <span className="iv-login__hairline-seg iv-login__hairline-seg--blue" />
            <span className="iv-login__hairline-seg iv-login__hairline-seg--violet" />
          </div>
          <p className="iv-login__billing iv-login__line" style={lineDelay(0)}>
            The Music and Fine Arts Club
          </p>
          <h1 className="iv-login__wordmark iv-login__line" style={lineDelay(1)}>
            MAFIA
          </h1>
          <div className="iv-login__dots iv-login__line" style={lineDelay(2)}>
            <SpectrumDots
              size={booting ? 8 : 6}
              loading={booting}
              label="Loading"
            />
          </div>
          {booting ? (
            slowBoot ? (
              <>
                <p className="iv-login__tagline">Signing in…</p>
                <div className="iv-login__credit">
                  <a className="iv-login__help" href="tel:9591185310">
                    Help: 9591185310
                  </a>
                </div>
              </>
            ) : null
          ) : (
            <>
              <p
                className="iv-login__tagline iv-login__line"
                style={lineDelay(3)}
              >
                Recruitment interviews · 2025–26
              </p>
              <div className="iv-login__cta iv-login__line" style={lineDelay(4)}>
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
              <div className="iv-login__credit iv-login__line" style={lineDelay(5)}>
                <a className="iv-login__help" href="tel:9591185310">
                  Help: 9591185310
                </a>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
