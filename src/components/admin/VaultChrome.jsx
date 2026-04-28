import React from "react";

/**
 * Vault direction chrome — sidebar, topbar, atoms.
 * Tokens locked here so the admin dashboard can opt into the Vault visual
 * language without touching every consumer of the global theme.
 */

export const VaultTokens = {
  bg: "#0B0B14",
  surface: "#13131F",
  surface2: "#1B1B2B",
  surface3: "#22223A",
  border: "#2A2A42",
  borderSoft: "rgba(255,255,255,0.06)",

  text: "#F5F5FA",
  textDim: "rgba(245,245,250,0.66)",
  textMute: "rgba(245,245,250,0.42)",

  purple: "#CC00CC",
  purpleSoft: "rgba(204,0,204,0.12)",
  purpleBorder: "rgba(204,0,204,0.32)",

  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.12)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.12)",
  amber: "#F59E0B",
  amberSoft: "rgba(245,158,11,0.12)",
  blue: "#60A5FA",
  blueSoft: "rgba(96,165,250,0.12)",

  fontSans: '"Inter", -apple-system, system-ui, sans-serif',
  fontDisplay: '"Outfit", "Inter", sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
  fontWordmark: '"Space Grotesk", "Outfit", "Inter", sans-serif',

  radius: 10,
};

const T = VaultTokens;

// ---------- Brand mark (vinyl asset already in /public) ----------
export function VaultMark({ size = 24 }) {
  return (
    <img
      src="/mafia-logo.png"
      alt="MAFIA"
      width={size}
      height={size}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}

// ---------- Type-based wordmark ----------
export function VaultWordmark({ size = 18, color, weight = 700 }) {
  return (
    <span style={{
      fontFamily: T.fontWordmark,
      fontWeight: weight,
      fontSize: size,
      letterSpacing: size > 28 ? "-0.03em" : "-0.02em",
      color: color || T.text,
      lineHeight: 0.95,
      display: "inline-block",
      fontFeatureSettings: '"ss01" on, "ss02" on',
    }}>
      MAFIA
    </span>
  );
}

// ---------- Stat tile ----------
export function VaultStat({ label, value, sub, accent }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding: "16px 18px",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase",
        color: T.textMute, fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 700,
        color: accent || T.text, marginTop: 6, lineHeight: 1, letterSpacing: -0.5,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textDim, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

// ---------- Status pill ----------
const PILL_STYLES = {
  neutral:  { bg: "rgba(255,255,255,0.06)", color: T.textDim, border: T.borderSoft },
  paid:     { bg: T.greenSoft,  color: T.green,  border: "rgba(34,197,94,0.3)" },
  unpaid:   { bg: T.redSoft,    color: T.red,    border: "rgba(239,68,68,0.3)" },
  verified: { bg: T.purpleSoft, color: T.purple, border: T.purpleBorder },
  pending:  { bg: T.amberSoft,  color: T.amber,  border: "rgba(245,158,11,0.3)" },
  live:     { bg: T.amberSoft,  color: T.amber,  border: "rgba(245,158,11,0.3)" },
  info:     { bg: T.blueSoft,   color: T.blue,   border: "rgba(96,165,250,0.3)" },
};

export function VaultPill({ children, variant = "neutral" }) {
  const s = PILL_STYLES[variant] || PILL_STYLES.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// ---------- Sidebar ----------
const NAV_ITEMS = [
  { label: "Dashboard",    icon: "▦" },
  { label: "Candidates",   icon: "▤" },
  { label: "Live Rooms",   icon: "◉" },
  { label: "Payments",     icon: "₹" },
  { label: "Interviewers", icon: "◐" },
  { label: "Audit Log",    icon: "≡" },
];

export function VaultSidebar({ active = "Dashboard", user, onNavigate, onLogout }) {
  return (
    <aside style={{
      width: 220,
      background: T.surface,
      borderRight: `1px solid ${T.border}`,
      padding: "20px 14px",
      display: "flex", flexDirection: "column", gap: 24,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
        <VaultMark size={32} />
        <div>
          <VaultWordmark size={20} />
          <div style={{
            fontSize: 10, color: T.textMute, letterSpacing: 1.4,
            textTransform: "uppercase", marginTop: 5, fontWeight: 500,
          }}>Recruit · 25–26</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((n) => {
          const isActive = n.label === active;
          return (
            <div
              key={n.label}
              onClick={() => onNavigate && onNavigate(n.label)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                color: isActive ? T.text : T.textDim,
                background: isActive ? T.purpleSoft : "transparent",
                borderLeft: `2px solid ${isActive ? T.purple : "transparent"}`,
                cursor: onNavigate ? "pointer" : "default",
              }}
            >
              <span style={{
                width: 14, fontSize: 12,
                color: isActive ? T.purple : T.textMute,
              }}>{n.icon}</span>
              {n.label}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {user && (
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: T.surface2, border: `1px solid ${T.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: T.purple, color: "white",
                fontWeight: 700, fontSize: 12,
                display: "grid", placeItems: "center",
              }}>{user.initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12, color: T.text, fontWeight: 600,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{user.name}</div>
                <div style={{ fontSize: 10, color: T.textMute }}>{user.role}</div>
              </div>
            </div>
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textDim, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: T.fontSans,
            }}
          >Sign out</button>
        )}
      </div>
    </aside>
  );
}

// ---------- Topbar ----------
export function VaultTopbar({ title, sub, lastUpdate, onExport }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 28px",
      borderBottom: `1px solid ${T.border}`,
      background: T.bg,
    }}>
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700,
          color: T.text, letterSpacing: -0.3,
        }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {lastUpdate && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 12px",
            border: `1px solid ${T.border}`, borderRadius: 8,
            background: T.surface,
            fontSize: 12, color: T.textDim, fontFamily: T.fontMono,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: T.green,
            }} />
            Live · {lastUpdate}
          </div>
        )}
        {onExport && (
          <button
            onClick={onExport}
            style={{
              padding: "8px 16px", border: "none", borderRadius: 8,
              background: T.purple, color: "white",
              fontFamily: T.fontSans, fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >Export</button>
        )}
      </div>
    </header>
  );
}

// ---------- Surface card (for content sections) ----------
export function VaultCard({ children, padding = 22, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding,
        ...style,
      }}
    >{children}</div>
  );
}

// ---------- Section header (used inside cards) ----------
export function VaultSectionHeader({ title, meta, actions }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
        {meta && (
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMute }}>
            {meta}
          </div>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ---------- Payment funnel chart ----------
export function VaultFunnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {steps.map((s) => {
        const pct = Math.round((s.value / max) * 100);
        return (
          <div key={s.label}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, color: T.textDim }}>{s.label}</span>
              <span style={{
                fontFamily: T.fontMono, fontSize: 12, color: T.text,
              }}>
                {s.value}{" "}
                <span style={{ color: T.textMute }}>· {pct}%</span>
              </span>
            </div>
            <div style={{
              height: 8, background: T.surface3,
              borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: s.color || T.purple,
                borderRadius: 4, transition: "width 400ms",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
