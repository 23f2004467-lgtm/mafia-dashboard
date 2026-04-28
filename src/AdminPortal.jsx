import React, { useEffect, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
import { ConfirmDialog } from './components/common';
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
import { DataCache, PerformanceMonitor } from './performanceOptimizations';
import {
  VaultTokens as T,
  VaultMark,
  VaultWordmark,
  VaultStat,
  VaultPill,
  VaultSidebar,
  VaultTopbar,
  VaultCard,
  VaultSectionHeader,
  VaultFunnel,
} from './components/admin/VaultChrome';

/**
 * MAFIA Recruitment Admin Portal — Vault direction
 * Sidebar + topbar + dashboard grid. Functionality preserved from prior version.
 */
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
      alert('Please enter both email and password');
      return;
    }

    if (!FirebaseSecurity.rateLimiter.checkLimit('admin_login', 3, 300000)) {
      alert('Too many admin login attempts. Please try again later.');
      return;
    }

    if (FirebaseSecurity.sessionManager.isLockedOut('admin_login')) {
      alert('Admin access temporarily locked due to too many failed attempts.');
      return;
    }

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
      alert("Admin login failed: " + error.message);
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

    const formattedData = filteredCandidates.map((cand) => ({
      Name: cand.name || "",
      RegNo: cand.regNo || "",
      Year: cand.year || "",
      College: cand.college || "",
      Branch: cand.branch || "",
      WhatsApp: cand.whatsappNumber || "",
      Paid: cand.paid ? "Yes" : "No",
      ManuallyVerified: cand.manuallyVerified ? "Yes" : "No",
      PaymentAmount: cand.paymentDetails?.amount || "",
      PaymentMethod: cand.paymentDetails?.method || "",
      TalentCommPrefs: `${cand.preferences?.talentComm?.pref1 || ""}${cand.preferences?.talentComm?.pref2 ? `, ${cand.preferences.talentComm.pref2}` : ""}`,
      WorkCommPrefs: `${cand.preferences?.workComm?.pref1 || ""}${cand.preferences?.workComm?.pref2 ? `, ${cand.preferences.workComm.pref2}` : ""}${cand.preferences?.workComm?.pref3 ? `, ${cand.preferences.workComm.pref3}` : ""}`,
      TalentCommVerdict: Array.isArray(cand.verdict?.talentComm) ? cand.verdict.talentComm.join(", ") : "",
      WorkCommVerdict: Array.isArray(cand.verdict?.workComm) ? cand.verdict.workComm.join(", ") : "",
      Comments: cand.comments || "",
      LastUpdatedBy: cand.lastUpdatedBy || "",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Candidates");
    worksheet.addRow(Object.keys(formattedData[0] || {}));
    formattedData.forEach(row => worksheet.addRow(Object.values(row)));

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

  // ---------- Login screen ----------
  if (!authenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: T.fontSans,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}>
        <div style={{
          width: "100%", maxWidth: 380,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 32,
        }}>
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", marginBottom: 28,
          }}>
            <VaultMark size={64} />
            <div style={{ marginTop: 18 }}><VaultWordmark size={34} /></div>
            <div style={{
              fontSize: 11, color: T.textMute, marginTop: 10,
              letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 500,
            }}>Admin · Recruitment 25–26</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              placeholder="admin@mafia.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={inputStyle}
            />
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              style={{
                marginTop: 6, padding: "12px 16px", borderRadius: 9,
                background: T.purple, color: "white", border: "none",
                fontWeight: 600, fontSize: 13,
                cursor: isLoggingIn ? "not-allowed" : "pointer",
                opacity: isLoggingIn ? 0.6 : 1,
              }}
            >{isLoggingIn ? "Signing in…" : "Sign in as admin"}</button>
          </div>

          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: `1px solid ${T.border}`,
            fontSize: 11, color: T.textMute, textAlign: "center",
          }}>
            Need help? <span style={{ color: T.textDim, fontFamily: T.fontMono }}>9591185310</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Dashboard ----------
  const lastUpdateLabel = `synced ${formatRelativeTime(lastUpdate)}`;
  const funnelSteps = [
    { label: "Checked in", value: total,             color: T.text },
    { label: "Paid",       value: paid,              color: T.green },
    { label: "Verified",   value: manuallyVerified,  color: T.purple },
    { label: "Unpaid",     value: unpaid,            color: T.red },
  ];

  return (
    <div style={{
      display: "flex", height: "100vh",
      background: T.bg, color: T.text,
      fontFamily: T.fontSans,
    }}>
      <VaultSidebar
        active="Dashboard"
        user={{ initials: "AD", name: "Admin", role: email || "Admin · Board" }}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <VaultTopbar
          title="Dashboard"
          sub={`${total} candidates · ${paid} paid (${percentPaid}%) · ${manuallyVerified} verified`}
          lastUpdate={lastUpdateLabel}
          onExport={exportToExcel}
        />

        <div style={{
          padding: 28, overflow: "auto",
          display: "flex", flexDirection: "column", gap: 24,
        }}>
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
                actions={
                  <button
                    onClick={forceLogoutAllInterviewers}
                    disabled={isForceLogoutLoading}
                    style={ghostBtnStyle(T.red)}
                  >
                    {isForceLogoutLoading ? "…" : "Force logout"}
                  </button>
                }
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
        </div>
      </main>

      {/* Confirmation modals — keep existing components */}
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
