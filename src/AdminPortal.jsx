import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
import { ConfirmDialog } from './components/common';
import { ToastHost, toast } from './ui';
import AdminLogin from './screens/admin/AdminLogin';
import AdminTopBar from './screens/admin/AdminTopBar';
import AdminStats from './screens/admin/AdminStats';
import AdminCandidatesTable from './screens/admin/AdminCandidatesTable';
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
import { PerformanceMonitor } from './performanceOptimizations';
import {
  VaultTokens as T,
  VaultCard,
  VaultSectionHeader,
} from './components/admin/VaultChrome';

/**
 * MAFIA Recruitment Admin Portal — House Lights dark stage (§7).
 * Phase 5a: dark shell + §7.1 login + §7.2 topbar. Phase 5b: §7.3 stat
 * strip + §7.4 candidates table (funnel card and duplicate Export
 * deleted, §2 #25/#27). All Firestore logic/writes/listeners live here;
 * rendering moves to src/ui/ + src/screens/admin/ presentational pieces.
 * The interviewers card stays Vault-styled until its §7.6 sub-step.
 */

// ---------- §7.4 filter model (search + one state filter) ----------
// Shared by the table memo AND the export scope so "export filtered"
// always means exactly what the table shows (§2 #27). Search semantics
// are byte-identical to the old inline predicate.
const matchesSearch = (cand, search) =>
  !search ||
  cand.name?.toLowerCase().includes(search.toLowerCase()) ||
  cand.regNo?.toLowerCase().includes(search.toLowerCase());

const hasSelectedVerdict = (cand) =>
  (Array.isArray(cand.verdict?.talentComm) && cand.verdict.talentComm.length > 0) ||
  (Array.isArray(cand.verdict?.workComm) && cand.verdict.workComm.length > 0);

// filter ∈ "all" | "unpaid" | "paid_unverified" | "verified" | "selected"
// (§5 derivations; replaces the old all/paid/unpaid <select>).
const matchesStateFilter = (cand, filter) => {
  switch (filter) {
    case "unpaid":
      return !cand.paid;
    case "paid_unverified":
      return Boolean(cand.paid) && !cand.manuallyVerified;
    case "verified":
      return Boolean(cand.manuallyVerified);
    case "selected":
      return hasSelectedVerdict(cand);
    default:
      return true;
  }
};

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

  // State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [candidates, setCandidates] = useState([]);
  // §7.3/§7.4: first-snapshot flag — tiles/rows skeleton until it flips;
  // "No candidates match your filters" may only appear after it.
  const [candidatesReady, setCandidatesReady] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterPaid, setFilterPaid] = useState("all");
  const [isForceLogoutLoading, setIsForceLogoutLoading] = useState(false);
  const [isClearDataLoading, setIsClearDataLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // §7.4 optimistic row feedback: regNo currently flashing green.
  const [flashRegNo, setFlashRegNo] = useState(null);
  const flashTimerRef = useRef(null);
  const flashRow = useCallback((regNo) => {
    setFlashRegNo(regNo);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Hold the flash class ~150 ms (120 ms fade-in), then let the
    // 800 ms fade-out run (TableRow.css).
    flashTimerRef.current = setTimeout(() => setFlashRegNo(null), 160);
  }, []);
  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  // §7.3 tile 3 → apply the Paid·unverified filter + scroll to the table.
  const tableCardRef = useRef(null);

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
  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  // §7.3 tile 3: paid claims not yet verified by the board.
  const awaitingVerification = candidates.filter(
    (c) => c.paid && !c.manuallyVerified
  ).length;

  const totalAmount = candidates.reduce((sum, c) => {
    if (c.paid) {
      const amount = c.paymentDetails?.amount ? Number(c.paymentDetails.amount) : 300;
      return sum + amount;
    }
    return sum;
  }, 0);

  // §2 #37 sub-line "of which ₹X verified" — same per-candidate amount
  // logic as totalAmount, scoped to verified payments (display only).
  const verifiedAmount = candidates.reduce((sum, c) => {
    if (c.paid && c.manuallyVerified) {
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
      flashRow(candidate.regNo); // §7.4 optimistic green row flash
    } catch (error) {
      console.error('Error manually verifying payment:', error);
      toast({ tone: 'error', message: 'Failed to manually verify payment: ' + error.message });
    }
  };

  const exportToExcel = async () => {
    // Scope = exactly what the table shows (same shared predicates the
    // §7.4 memo uses). ExcelJS internals + buildExportRows below stay
    // byte-identical (landmines #9/#10).
    const filteredCandidates = candidates.filter(
      (cand) => matchesSearch(cand, search) && matchesStateFilter(cand, filterPaid)
    );

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
      setCandidatesReady(true); // §7.3/§7.4: skeletons end at the FIRST snapshot
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

  // Filtered candidates (§7.4). The old DataCache wrapper is gone: its
  // 30 s TTL keyed on candidates.length served stale rows after any
  // field-level change (e.g. a verify flip) — useMemo over the live
  // snapshot array is both correct and cheap at ≤ 1000 docs.
  const searchedCandidates = useMemo(
    () => candidates.filter((cand) => matchesSearch(cand, search)),
    [candidates, search]
  );

  // Live chip counts over the current search scope (§7.4 toolbar).
  const stateCounts = useMemo(
    () => ({
      all: searchedCandidates.length,
      unpaid: searchedCandidates.filter((c) => !c.paid).length,
      paid_unverified: searchedCandidates.filter((c) => c.paid && !c.manuallyVerified).length,
      verified: searchedCandidates.filter((c) => Boolean(c.manuallyVerified)).length,
      selected: searchedCandidates.filter(hasSelectedVerdict).length,
    }),
    [searchedCandidates]
  );

  const filteredCandidates = useMemo(
    () => searchedCandidates.filter((cand) => matchesStateFilter(cand, filterPaid)),
    [searchedCandidates, filterPaid]
  );

  // §7.3 tile 3 (Awaiting verification) is actionable: apply the
  // Paid·unverified filter and scroll to the table card.
  const jumpToAwaiting = useCallback(() => {
    setFilterPaid("paid_unverified");
    const node = tableCardRef.current;
    if (node) {
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, []);

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
  return (
    <div className="admin-root" data-theme="dark">
      <AdminTopBar
        lastSyncAt={lastUpdate}
        onExport={exportToExcel}
        onForceLogout={() => setShowForceLogoutModal(true)}
        forceLogoutBusy={isForceLogoutLoading}
        onDangerReset={() => setShowClearDataModal(true)}
        dangerResetBusy={isClearDataLoading}
        onDangerDelete={() => setShowDeleteDataModal(true)}
        onSignOut={handleLogout}
        userEmail={email}
      />

      <main className="admin-main">
        {/* §7.3 stat strip (funnel card deleted, §2 #25) */}
        <AdminStats
          loading={!candidatesReady}
          total={total}
          paid={paid}
          percentPaid={percentPaid}
          awaiting={awaitingVerification}
          revenue={totalAmount}
          verifiedRevenue={verifiedAmount}
          onAwaitingClick={jumpToAwaiting}
        />

        {/* §7.4 candidates table — the workhorse card */}
        <AdminCandidatesTable
          rows={filteredCandidates}
          ready={candidatesReady}
          search={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          onClearSearch={() => setSearch("")}
          filter={filterPaid}
          onFilterChange={setFilterPaid}
          counts={stateCounts}
          onClearFilters={() => {
            setSearch("");
            setFilterPaid("all");
          }}
          flashRegNo={flashRegNo}
          onVerify={manuallyVerifyPayment}
          scrollRef={tableCardRef}
          filterKey={`${search}|${filterPaid}`}
          formatWhen={(stamp) => formatRelativeTime(toDate(stamp))}
        />

        {/* Active interviewers — still Vault-styled until its §7.6 sub-step */}
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
