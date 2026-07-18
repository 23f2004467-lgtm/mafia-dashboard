import React, { useCallback, useEffect, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
import { ConfirmDialog } from './components/common';
import { ToastHost } from './ui';
import AdminLogin from './screens/admin/AdminLogin';
import AdminTopBar from './screens/admin/AdminTopBar';
import './AdminPortal.css';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  limit
} from "firebase/firestore";
import * as ExcelJS from "exceljs";
import { buildExportRows } from "./exportRows";
import { DataCache, PerformanceMonitor } from './performanceOptimizations';
import {
  VaultTokens as T,
  VaultStat,
  VaultPill,
  VaultCard,
  VaultSectionHeader,
  VaultFunnel,
} from './components/admin/VaultChrome';

/**
 * MAFIA Recruitment Admin Portal — House Lights dark stage (§7).
 * Phase 5a: dark shell + §7.1 login + §7.2 topbar. All Firestore
 * logic/writes/listeners live here; rendering moves to src/ui/ +
 * src/screens/admin/ presentational pieces. Dashboard body cards are
 * still Vault-styled until 5b–5d.
 */

// §7.1: the admin rate limit (3 attempts / 5 min) — the same literals the
// checkLimit call has always used, lifted to consts so the login Banner
// DERIVES its countdown from them instead of restating numbers in copy.
const ADMIN_RATE_LIMIT_MAX_ATTEMPTS = 3;
const ADMIN_RATE_LIMIT_WINDOW_MS = 300000;

// When the current rate-limit window frees a slot (display only — reads
// the same RateLimiter state the guard consults; never mutates it).
function rateLimitRetryAt() {
  const stamps = FirebaseSecurity.rateLimiter.attempts.get('admin_login') || [];
  const now = Date.now();
  const valid = stamps.filter((t) => now - t < ADMIN_RATE_LIMIT_WINDOW_MS);
  if (valid.length === 0) return now + 1000;
  return Math.min(...valid) + ADMIN_RATE_LIMIT_WINDOW_MS;
}

// When the SECURITY_CONFIG lockout lifts (display only — derived from the
// same SessionManager state + config isLockedOut consults).
function lockoutRetryAt() {
  const rec = FirebaseSecurity.sessionManager.failedAttempts.get('admin_login');
  if (!rec) return Date.now() + 1000;
  return rec.lastAttempt + FirebaseSecurity.config.lockoutDuration;
}
function AdminPortal() {
  const performanceMonitor = useMemo(() => new PerformanceMonitor(), []);
  const dataCache = useMemo(() => new DataCache(100), []);

  // State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPaid, setFilterPaid] = useState("all");
  const [isForceLogoutLoading, setIsForceLogoutLoading] = useState(false);
  const [isClearDataLoading, setIsClearDataLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);

  // §7.1 inline login error (replaces the four login alert()s):
  // null | { kind: 'missing'|'rate'|'lockout'|'failed', message?, remaining?, until? }
  const [loginError, setLoginError] = useState(null);
  const clearLoginError = useCallback(() => setLoginError(null), []);

  // Payment analytics
  const total = candidates.length;
  const paid = candidates.filter((c) => c.paid).length;
  const unpaid = total - paid;
  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  const manuallyVerified = candidates.filter((c) => c.manuallyVerified).length;

  const totalAmount = candidates.reduce((sum, c) => {
    if (c.paid) {
      const amount = c.paymentDetails?.amount ? Number(c.paymentDetails.amount) : 300;
      return sum + amount;
    }
    return sum;
  }, 0);

  // Handlers — unchanged
  const handleLogin = async () => {
    if (isLoggingIn) return;
    if (!email || !password) {
      setLoginError({ kind: 'missing' });
      return;
    }

    if (!FirebaseSecurity.rateLimiter.checkLimit('admin_login', ADMIN_RATE_LIMIT_MAX_ATTEMPTS, ADMIN_RATE_LIMIT_WINDOW_MS)) {
      setLoginError({ kind: 'rate', until: rateLimitRetryAt() });
      return;
    }

    if (FirebaseSecurity.sessionManager.isLockedOut('admin_login')) {
      setLoginError({ kind: 'lockout', until: lockoutRetryAt() });
      return;
    }

    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await SecureAdminAuth.adminLogin(email, password);
      FirebaseSecurity.sessionManager.recordLoginAttempt('admin_login', true);
      FirebaseSecurity.auditLogger.logEvent('admin_login_success', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        email: email
      });
      setAuthenticated(true);
    } catch (error) {
      console.error('Admin login failed:', error);
      FirebaseSecurity.sessionManager.recordLoginAttempt('admin_login', false);
      FirebaseSecurity.auditLogger.logEvent('admin_login_failed', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        email: email,
        error: error.message
      });
      // Presentation only: derive remaining attempts from the same
      // SessionManager state + SECURITY_CONFIG the lockout guard uses.
      const failedCount = FirebaseSecurity.sessionManager.failedAttempts.get('admin_login')?.count || 0;
      const remaining = Math.max(0, FirebaseSecurity.config.maxLoginAttempts - failedCount);
      if (remaining === 0) {
        setLoginError({ kind: 'lockout', until: lockoutRetryAt() });
      } else {
        setLoginError({ kind: 'failed', message: "Admin login failed: " + error.message, remaining });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureAdminAuth.adminLogout();
    } catch (error) {
      console.error('Admin logout failed:', error);
    } finally {
      setAuthenticated(false);
      setEmail("");
      setPassword("");
    }
  };

  const clearAllInterviewerData = async () => {
    setIsClearDataLoading(true);
    try {
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);

      const updatePromises = snapshot.docs.map(doc => {
        const candidateData = doc.data();
        return setDoc(doc.ref, {
          ...candidateData,
          paid: false,
          paymentDetails: null,
          verdict: { talentComm: [], workComm: [] },
          comments: '',
          lastUpdatedBy: 'Admin - Data Reset',
          lastUpdatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(updatePromises);

      FirebaseSecurity.auditLogger.logEvent('admin_clear_all_data', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        adminEmail: email,
        candidatesCleared: snapshot.docs.length
      });

      alert(`Successfully cleared all interviewer data for ${snapshot.docs.length} candidates.`);
      setShowClearDataModal(false);
    } catch (error) {
      console.error('Error clearing interviewer data:', error);
      alert('Failed to clear interviewer data: ' + error.message);
    } finally {
      setIsClearDataLoading(false);
    }
  };

  const forceLogoutAllInterviewers = async () => {
    setIsForceLogoutLoading(true);
    try {
      const interviewersRef = collection(db, "interviewers");
      const snapshot = await getDocs(interviewersRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      alert("All interviewers have been force logged out successfully.");
    } catch (error) {
      console.error("Error force logging out interviewers:", error);
      alert("Error force logging out interviewers: " + error.message);
    } finally {
      setIsForceLogoutLoading(false);
    }
  };

  const clearAllCandidateData = async () => {
    try {
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);

      if (snapshot.empty) {
        alert("No candidate data found to delete.");
        return;
      }

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const paymentSessionsRef = collection(db, "paymentSessions");
      const paymentSnapshot = await getDocs(paymentSessionsRef);
      const paymentDeletePromises = paymentSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentDeletePromises);

      alert(`Successfully deleted ${snapshot.docs.length} candidate records and ${paymentSnapshot.docs.length} payment sessions.`);

      FirebaseSecurity.auditLogger.logEvent('admin_cleared_all_data', {
        timestamp: new Date().toISOString(),
        adminEmail: email,
        candidatesDeleted: snapshot.docs.length,
        paymentSessionsDeleted: paymentSnapshot.docs.length
      });

      setShowDeleteDataModal(false);
    } catch (error) {
      console.error("Error clearing candidate data:", error);
      alert("Error clearing candidate data: " + error.message);
    }
  };

  const manuallyVerifyPayment = async (candidate) => {
    if (!candidate.paid || candidate.manuallyVerified) return;

    try {
      const candidateRef = doc(db, 'candidates', candidate.regNo);
      await setDoc(candidateRef, {
        manuallyVerified: true,
        manualVerificationDetails: {
          verifiedBy: 'Admin',
          verifiedAt: new Date().toISOString(),
          paymentAmount: candidate.paymentDetails?.amount || 300,
          paymentMethod: candidate.paymentDetails?.method || 'Manual Verification'
        },
        lastUpdatedBy: 'Admin',
        lastUpdatedAt: new Date().toISOString()
      }, { merge: true });

      setCandidates(prev => prev.map(c =>
        c.regNo === candidate.regNo
          ? { ...c, manuallyVerified: true, manualVerificationDetails: { verifiedBy: 'Admin', verifiedAt: new Date().toISOString() } }
          : c
      ));
    } catch (error) {
      console.error('Error manually verifying payment:', error);
      alert('Failed to manually verify payment: ' + error.message);
    }
  };

  const exportToExcel = async () => {
    const filteredCandidates = candidates.filter((cand) => {
      const matchesSearch = !search ||
        cand.name?.toLowerCase().includes(search.toLowerCase()) ||
        cand.regNo?.toLowerCase().includes(search.toLowerCase());
      const matchesPaid = filterPaid === "all" ||
        (filterPaid === "paid" && cand.paid) ||
        (filterPaid === "unpaid" && !cand.paid);
      return matchesSearch && matchesPaid;
    });

    const rows = buildExportRows(filteredCandidates);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Candidates");
    rows.forEach(row => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "mafia_recruitments.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Effects — unchanged
  useEffect(() => {
    if (!authenticated) return;

    const startTime = performanceMonitor.startTimer();
    const q = query(collection(db, "candidates"), orderBy("regNo"), limit(1000));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setCandidates(data);
      setLastUpdate(new Date()); // §7.2 sync pill: candidates-snapshot receipt timestamp
      const fetchTime = performanceMonitor.endTimer(startTime);
      performanceMonitor.logMetric('adminCandidatesFetchTime', fetchTime);
    });

    return () => unsub();
  }, [authenticated, performanceMonitor]);

  useEffect(() => {
    if (!authenticated) return;

    const startTime = performanceMonitor.startTimer();
    const unsub = onSnapshot(
      query(collection(db, "interviewers"), limit(100)),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          email: doc.id,
          lastActive: doc.data().lastActive,
          loginTime: doc.data().loginTime
        }));
        setInterviewers(data);
        setLastUpdate(new Date());
        const fetchTime = performanceMonitor.endTimer(startTime);
        performanceMonitor.logMetric('adminInterviewersFetchTime', fetchTime);
      }
    );

    const cleanupOldSessions = async () => {
      try {
        const interviewersRef = collection(db, "interviewers");
        const snapshot = await getDocs(interviewersRef);
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        const deletePromises = snapshot.docs
          .filter(doc => {
            const lastActive = doc.data().lastActive;
            if (!lastActive) return true;
            const lastActiveTime = lastActive.seconds ? new Date(lastActive.seconds * 1000) : new Date(lastActive);
            return lastActiveTime < twoHoursAgo;
          })
          .map(doc => deleteDoc(doc.ref));

        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
        }
      } catch (error) {
        console.error("Error cleaning up old sessions:", error);
      }
    };

    const cleanupInterval = setInterval(cleanupOldSessions, 30 * 60 * 1000);
    cleanupOldSessions();

    return () => {
      unsub();
      clearInterval(cleanupInterval);
    };
  }, [authenticated, performanceMonitor]);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    const cacheKey = `filter_${search}_${filterPaid}_${candidates.length}`;
    const cachedResult = dataCache.get(cacheKey);

    if (cachedResult) return cachedResult;

    const result = candidates.filter((cand) => {
      const matchesSearch = !search ||
        cand.name?.toLowerCase().includes(search.toLowerCase()) ||
        cand.regNo?.toLowerCase().includes(search.toLowerCase());
      const matchesPaid = filterPaid === "all" ||
        (filterPaid === "paid" && cand.paid) ||
        (filterPaid === "unpaid" && !cand.paid);
      return matchesSearch && matchesPaid;
    });

    dataCache.set(cacheKey, result, 30 * 1000);
    return result;
  }, [candidates, search, filterPaid, dataCache]);

  // ---------- Login screen (§7.1) ----------
  if (!authenticated) {
    return (
      <div className="admin-root" data-theme="dark">
        <AdminLogin
          email={email}
          password={password}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
          isLoggingIn={isLoggingIn}
          error={loginError}
          onErrorExpired={clearLoginError}
        />
      </div>
    );
  }

  // ---------- Dashboard ----------
  const funnelSteps = [
    { label: "Checked in", value: total,             color: T.text },
    { label: "Paid",       value: paid,              color: T.green },
    { label: "Verified",   value: manuallyVerified,  color: T.purple },
    { label: "Unpaid",     value: unpaid,            color: T.red },
  ];

  return (
    <div className="admin-root" data-theme="dark">
      <AdminTopBar
        lastSyncAt={lastUpdate}
        onExport={exportToExcel}
        onForceLogout={() => setShowForceLogoutModal(true)}
        forceLogoutBusy={isForceLogoutLoading}
        onDangerReset={() => setShowClearDataModal(true)}
        onDangerDelete={() => setShowDeleteDataModal(true)}
        onSignOut={handleLogout}
        userEmail={email}
      />

      <main className="admin-main">
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <VaultStat
              label="Checked-in"
              value={total}
              sub="registered candidates"
            />
            <VaultStat
              label="Paid"
              value={`${paid}/${total || 0}`}
              sub={`${percentPaid}% conversion`}
              accent={T.green}
            />
            <VaultStat
              label="Verified"
              value={manuallyVerified}
              sub={`${Math.max(0, paid - manuallyVerified)} awaiting review`}
              accent={T.purple}
            />
            <VaultStat
              label="Revenue"
              value={`₹${(totalAmount / 1000).toFixed(1)}k`}
              sub={`${paid} payments collected`}
            />
          </div>

          {/* Funnel + Active interviewers */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            <VaultCard>
              <VaultSectionHeader title="Payment funnel" meta="live" />
              <VaultFunnel steps={funnelSteps} />
            </VaultCard>

            <VaultCard>
              <VaultSectionHeader
                title="Active interviewers"
                meta={`${interviewers.length} online`}
              />
              <div style={{
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: 240, overflow: "auto",
              }}>
                {interviewers.length === 0 ? (
                  <div style={{
                    padding: 16, fontSize: 12, color: T.textMute,
                    fontStyle: "italic", textAlign: "center",
                  }}>No active interviewers</div>
                ) : interviewers.map((iv, idx) => (
                  <div key={idx} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: T.surface2,
                    border: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12, color: T.text, fontWeight: 600,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{iv.email}</div>
                      <div style={{
                        fontSize: 10, color: T.textMute,
                        fontFamily: T.fontMono, marginTop: 2,
                      }}>
                        {iv.lastActive ? `active ${formatRelativeTime(toDate(iv.lastActive))}` : "—"}
                      </div>
                    </div>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: T.green, flexShrink: 0,
                    }} />
                  </div>
                ))}
              </div>
            </VaultCard>
          </div>

          {/* Candidates table */}
          <VaultCard padding={0}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Candidates{" "}
                <span style={{ color: T.textMute, fontFamily: T.fontMono, fontSize: 12 }}>
                  · {filteredCandidates.length}/{total}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Search reg no or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputStyle, padding: "7px 12px", width: 220, fontSize: 12 }}
                />
                <select
                  value={filterPaid}
                  onChange={(e) => setFilterPaid(e.target.value)}
                  style={{ ...inputStyle, padding: "7px 12px", fontSize: 12 }}
                >
                  <option value="all">All status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {["Reg No", "Name", "Branch", "Preference", "Verdict", "Payment", "Updated", ""].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left",
                        fontWeight: 600, color: T.textMute,
                        fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{
                        padding: 32, textAlign: "center",
                        color: T.textMute, fontSize: 12,
                      }}>No candidates match your filters.</td>
                    </tr>
                  ) : filteredCandidates.map((c, idx) => (
                    <tr key={c.regNo || idx} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <td style={{ padding: "12px 16px", fontFamily: T.fontMono, color: T.textDim }}>
                        {c.regNo}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: "12px 16px", color: T.textDim }}>{c.branch || "—"}</td>
                      <td style={{ padding: "12px 16px", color: T.textDim }}>
                        {c.preferences?.talentComm?.pref1 || "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {Array.isArray(c.verdict?.talentComm) && c.verdict.talentComm.length > 0
                          ? <VaultPill variant="info">{c.verdict.talentComm[0]}</VaultPill>
                          : <span style={{ color: T.textMute }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {c.manuallyVerified
                          ? <VaultPill variant="verified">verified</VaultPill>
                          : c.paid
                            ? <VaultPill variant="paid">paid</VaultPill>
                            : <VaultPill variant="unpaid">unpaid</VaultPill>}
                      </td>
                      <td style={{
                        padding: "12px 16px", fontFamily: T.fontMono,
                        color: T.textMute, fontSize: 11,
                      }}>{c.lastUpdatedBy || "—"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {c.paid && !c.manuallyVerified && (
                          <button
                            onClick={() => manuallyVerifyPayment(c)}
                            style={ghostBtnStyle(T.purple)}
                          >Verify</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </VaultCard>

          {/* Admin actions */}
          <VaultCard>
            <VaultSectionHeader
              title="Administrative actions"
              meta="destructive · audited"
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={exportToExcel} style={primaryBtnStyle()}>
                Export to Excel
              </button>
              <button
                onClick={() => setShowClearDataModal(true)}
                disabled={isClearDataLoading}
                style={dangerBtnStyle()}
              >
                {isClearDataLoading ? "Clearing…" : "Clear interviewer data"}
              </button>
              <button
                onClick={() => setShowDeleteDataModal(true)}
                style={dangerBtnStyle()}
              >
                Clear all candidate data
              </button>
            </div>
          </VaultCard>
      </main>

      {/* Confirmation modals — old ConfirmDialog survives until 5e (landmine #8) */}
      <ConfirmDialog
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onConfirm={clearAllInterviewerData}
        title="Clear All Interviewer Data"
        message="This will reset all candidates to their original state. All interview verdicts, payment confirmations, and comments will be permanently removed."
        confirmText="Clear Data"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteDataModal}
        onClose={() => setShowDeleteDataModal(false)}
        onConfirm={clearAllCandidateData}
        title="Delete All Candidate Data"
        message="This will PERMANENTLY delete ALL candidate records from the database. This action cannot be undone."
        confirmText="Delete All"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showForceLogoutModal}
        onClose={() => setShowForceLogoutModal(false)}
        onConfirm={forceLogoutAllInterviewers}
        title="Force Logout All Interviewers"
        message={`This will end all ${interviewers.length} active interviewer sessions. Interviewers will need to sign in again.`}
        confirmText="Force Logout All"
        variant="danger"
      />

      <ToastHost position="bottom-right" />
    </div>
  );
}

// ---------- Local style helpers ----------
const inputStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  background: T.surface2,
  color: T.text,
  fontFamily: T.fontSans,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

function primaryBtnStyle() {
  return {
    padding: "9px 14px", borderRadius: 8,
    background: T.purple, color: "white", border: "none",
    fontWeight: 600, fontSize: 12, cursor: "pointer",
    fontFamily: T.fontSans,
  };
}

function dangerBtnStyle() {
  return {
    padding: "9px 14px", borderRadius: 8,
    background: T.redSoft, color: T.red,
    border: `1px solid rgba(239,68,68,0.3)`,
    fontWeight: 600, fontSize: 12, cursor: "pointer",
    fontFamily: T.fontSans,
  };
}

function ghostBtnStyle(color) {
  return {
    padding: "5px 10px", borderRadius: 6,
    background: "transparent", color: color || T.textDim,
    border: `1px solid ${color === T.red ? "rgba(239,68,68,0.3)" : T.border}`,
    fontWeight: 600, fontSize: 11, cursor: "pointer",
    fontFamily: T.fontSans,
  };
}

// Small util — relative time without pulling a date library
function toDate(stamp) {
  if (!stamp) return null;
  if (stamp.seconds) return new Date(stamp.seconds * 1000);
  return new Date(stamp);
}
function formatRelativeTime(date) {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default AdminPortal;
