import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
import { Button, Dialog, ToastHost, toast } from './ui';
import AdminLogin from './screens/admin/AdminLogin';
import AdminTopBar from './screens/admin/AdminTopBar';
import AdminStats from './screens/admin/AdminStats';
import AdminCandidatesTable, { verdictDomains } from './screens/admin/AdminCandidatesTable';
import AdminCandidateDrawer from './screens/admin/AdminCandidateDrawer';
import AdminInterviewers from './screens/admin/AdminInterviewers';
import AdminActivity from './screens/admin/AdminActivity';
import { canUndo } from './undoGuard';
import './AdminPortal.css';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  limit
} from "firebase/firestore";
import * as ExcelJS from "exceljs";
import { buildExportRows } from "./exportRows";
import { PerformanceMonitor } from './performanceOptimizations';

/**
 * MAFIA Recruitment Admin Portal — House Lights dark stage (§7).
 * Phase 5a: dark shell + §7.1 login + §7.2 topbar. Phase 5b: §7.3 stat
 * strip + §7.4 candidates table (funnel card and duplicate Export
 * deleted, §2 #25/#27). Phase 5c: §7.5 candidate drawer — row click opens
 * the full record; verify moves next to the evidence (confirm popover →
 * existing write → Undo toast) and the §2 #26 reverse/undo-verify revert
 * (the ONE sanctioned net-new admin mutation) lands here. Phase 5d:
 * §7.6 interviewers panel (honest presence + "N today" + per-row End
 * session, all off the ONE existing interviewers listener — landmine #13),
 * §7.7 live activity card (client-side over the candidates snapshot, no
 * new listeners), and the §2 #27 export scope popover + progress + toast.
 * Phase 5e (last, landmine #8): §7.8 danger zone + every remaining confirm
 * on the new Dialog (typed confirms RESET/DELETE, busy state HOLDS the
 * dialog open until the async op resolves — the old Modal closed
 * instantly on confirm); the last admin blocking alerts die into toasts;
 * the old components/common + styles/theme.js are deleted.
 * All Firestore logic/writes/listeners live here; rendering moves to
 * src/ui/ + src/screens/admin/ presentational pieces.
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
  // §7.8: delete-all busy flag (presentation only — the new Dialog holds
  // open on `busy` until the async op resolves, §2 #38).
  const [isDeleteDataLoading, setIsDeleteDataLoading] = useState(false);
  // §7.5: reverse-verification in flight (Dialog busy-hold).
  const [isReversing, setIsReversing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  // §2 #27: export progress state (button spinner + re-entry guard).
  const [isExporting, setIsExporting] = useState(false);
  // §7.6: email of the session currently being ended (popover busy state).
  const [endingSessionEmail, setEndingSessionEmail] = useState(null);

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

  // §7.5 drawer: regNo of the open candidate (kept through the exit
  // animation) + open flag. The candidate object itself is derived LIVE
  // from the candidates snapshot so drawer contents track echoes.
  const [drawerRegNo, setDrawerRegNo] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // §7.5 reverse verification: regNo pending the confirm dialog.
  const [reverseRegNo, setReverseRegNo] = useState(null);

  // §7.1 inline login error (replaces the four old login alerts):
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

      toast({ tone: 'success', message: `Reset interview data for ${snapshot.docs.length} candidates` });
      setShowClearDataModal(false);
    } catch (error) {
      console.error('Error clearing interviewer data:', error);
      // Dialog stays open (busy released) so the op can be retried.
      toast({ tone: 'error', message: 'Failed to reset interview data: ' + error.message });
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
      toast({ tone: 'success', message: `Ended ${snapshot.docs.length} interviewer ${snapshot.docs.length === 1 ? 'session' : 'sessions'}` });
      setShowForceLogoutModal(false); // close AFTER the op resolves (§2 #38)
    } catch (error) {
      console.error("Error force logging out interviewers:", error);
      toast({ tone: 'error', message: "Error force logging out interviewers: " + error.message });
    } finally {
      setIsForceLogoutLoading(false);
    }
  };

  // §7.6 per-row "End session" — the existing single-doc delete (the same
  // deleteDoc path force-logout applies in bulk), scoped to one email.
  const endInterviewerSession = async (interviewerEmail) => {
    setEndingSessionEmail(interviewerEmail);
    try {
      await deleteDoc(doc(db, "interviewers", interviewerEmail));
      toast({ tone: 'success', message: `Session ended · ${interviewerEmail}` });
    } catch (error) {
      console.error("Error ending interviewer session:", error);
      toast({ tone: 'error', message: 'Failed to end session: ' + error.message });
    } finally {
      setEndingSessionEmail(null);
    }
  };

  const clearAllCandidateData = async () => {
    setIsDeleteDataLoading(true);
    try {
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);

      if (snapshot.empty) {
        toast({ message: "No candidate data found to delete." });
        setShowDeleteDataModal(false);
        return;
      }

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const paymentSessionsRef = collection(db, "paymentSessions");
      const paymentSnapshot = await getDocs(paymentSessionsRef);
      const paymentDeletePromises = paymentSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentDeletePromises);

      toast({ tone: 'success', message: `Deleted ${snapshot.docs.length} candidate records and ${paymentSnapshot.docs.length} payment sessions` });

      FirebaseSecurity.auditLogger.logEvent('admin_cleared_all_data', {
        timestamp: new Date().toISOString(),
        adminEmail: email,
        candidatesDeleted: snapshot.docs.length,
        paymentSessionsDeleted: paymentSnapshot.docs.length
      });

      setShowDeleteDataModal(false);
    } catch (error) {
      console.error("Error clearing candidate data:", error);
      // Dialog stays open (busy released) so the op can be retried.
      toast({ tone: 'error', message: "Error clearing candidate data: " + error.message });
    } finally {
      setIsDeleteDataLoading(false);
    }
  };

  // The EXISTING verify write (§7.5). Presentation-layer changes only: the
  // timestamp is hoisted to ONE const used by both fields it always stamped
  // (verifiedAt / lastUpdatedAt — identical values, same write call), so
  // the returned `writtenMeta` lets the Undo stale-check (§2 #12) compare
  // against exactly what this write stamped. Returns the captured undo
  // context on success, null on failure.
  const manuallyVerifyPayment = async (candidate) => {
    if (!candidate.paid || candidate.manuallyVerified) return null;

    try {
      const nowIso = new Date().toISOString();
      const candidateRef = doc(db, 'candidates', candidate.regNo);
      await setDoc(candidateRef, {
        manuallyVerified: true,
        manualVerificationDetails: {
          verifiedBy: 'Admin',
          verifiedAt: nowIso,
          paymentAmount: candidate.paymentDetails?.amount || 300,
          paymentMethod: candidate.paymentDetails?.method || 'Manual Verification'
        },
        lastUpdatedBy: 'Admin',
        lastUpdatedAt: nowIso
      }, { merge: true });

      setCandidates(prev => prev.map(c =>
        c.regNo === candidate.regNo
          ? {
              ...c,
              manuallyVerified: true,
              manualVerificationDetails: { verifiedBy: 'Admin', verifiedAt: nowIso },
              lastUpdatedBy: 'Admin',
              lastUpdatedAt: nowIso
            }
          : c
      ));
      flashRow(candidate.regNo); // §7.4 optimistic green row flash
      return {
        regNo: candidate.regNo,
        name: candidate.name,
        writtenMeta: { lastUpdatedAt: nowIso, lastUpdatedBy: 'Admin' }
      };
    } catch (error) {
      console.error('Error manually verifying payment:', error);
      toast({ tone: 'error', message: 'Failed to manually verify payment: ' + error.message });
      return null;
    }
  };

  // §2 #26 — the ONE sanctioned net-new admin mutation, written ONCE and
  // reused by both Reverse verification and the verify-toast Undo:
  // manuallyVerified:false + clear verifiedBy/verifiedAt (they live inside
  // manualVerificationDetails) via the existing update path (same doc ref,
  // same merge-setDoc shape, same meta stamping the verify write uses).
  const revertVerification = async (regNo) => {
    const nowIso = new Date().toISOString();
    const candidateRef = doc(db, 'candidates', regNo);
    await setDoc(candidateRef, {
      manuallyVerified: false,
      manualVerificationDetails: null,
      lastUpdatedBy: 'Admin',
      lastUpdatedAt: nowIso
    }, { merge: true });

    setCandidates(prev => prev.map(c =>
      c.regNo === regNo
        ? {
            ...c,
            manuallyVerified: false,
            manualVerificationDetails: null,
            lastUpdatedBy: 'Admin',
            lastUpdatedAt: nowIso
          }
        : c
    ));
    flashRow(regNo);
  };

  // Verify confirmed in the drawer popover: existing write → optimistic
  // flash → Toast with Undo (10 s). Resolves true so the popover closes.
  const handleVerifyConfirmed = async (candidate) => {
    const captured = await manuallyVerifyPayment(candidate);
    if (!captured) return false;
    toast({
      message: `Verified · ${captured.name}`,
      undo: { label: 'Undo', ms: 10000, onUndo: () => undoVerification(captured) }
    });
    return true;
  };

  // Undo = the same revert, guarded by the §2 #12 stale-check (fresh read →
  // canUndo over lastUpdatedAt/lastUpdatedBy → write; no transaction).
  const undoVerification = async (captured) => {
    try {
      const ref = doc(db, 'candidates', captured.regNo);
      const freshSnap = await getDoc(ref);
      const freshData = freshSnap.exists() ? freshSnap.data() : null;
      const freshMeta = freshData
        ? {
            lastUpdatedAt: freshData.lastUpdatedAt,
            lastUpdatedBy: freshData.lastUpdatedBy,
          }
        : null;

      if (!canUndo(captured.writtenMeta, freshMeta)) {
        const who = (freshMeta && freshMeta.lastUpdatedBy) || 'another user';
        toast({
          tone: 'error',
          message: `Changed by ${who} just now — not undone.`,
        });
        return;
      }

      await revertVerification(captured.regNo);
      toast({ tone: 'success', message: `Verification undone · ${captured.name}` });
    } catch (error) {
      console.error('Error undoing verification:', error);
      toast({ tone: 'error', message: 'Undo failed: ' + error.message });
    }
  };

  // Reverse verification (§7.5): drawer destructive ghost → new Dialog,
  // held open on `busy` until the revert write resolves (§2 #38).
  const confirmReverseVerification = async () => {
    const target = candidates.find((c) => c.regNo === reverseRegNo);
    if (!target || !target.manuallyVerified) {
      setReverseRegNo(null);
      return;
    }
    setIsReversing(true);
    try {
      await revertVerification(target.regNo);
      toast({ tone: 'success', message: `Verification reversed · ${target.name}` });
      setReverseRegNo(null);
    } catch (error) {
      console.error('Error reversing verification:', error);
      // Dialog stays open (busy released) so the op can be retried.
      toast({ tone: 'error', message: 'Failed to reverse verification: ' + error.message });
    } finally {
      setIsReversing(false);
    }
  };

  const exportToExcel = async (scope = "all") => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Scope (§2 #27): "filtered" = exactly what the table shows (same
      // shared predicates the §7.4 memo uses); "all" = every candidate.
      // ExcelJS internals + buildExportRows below stay byte-identical
      // (landmines #9/#10).
      const scopedCandidates =
        scope === "filtered"
          ? candidates.filter(
              (cand) => matchesSearch(cand, search) && matchesStateFilter(cand, filterPaid)
            )
          : candidates;

      const rows = buildExportRows(scopedCandidates);

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

      toast({ tone: 'success', message: `Exported ${scopedCandidates.length} rows · mafia_recruitments.xlsx` });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ tone: 'error', message: 'Export failed: ' + error.message });
    } finally {
      setIsExporting(false);
    }
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

  // §2 #27: any active search/filter routes Export through the scope popover.
  const filtersActive = Boolean(search) || filterPaid !== "all";

  // §7.6 interviewers panel rows — the ONE existing interviewers listener's
  // data (landmine #13) joined client-side against the candidates snapshot:
  // "N today" = candidates this email last touched today (§2 #34, admin-side
  // counts sanctioned); "last touched" = most recent such candidate. NOTE:
  // interviewer writes stamp lastUpdatedBy with displayName || email, so
  // the email join undercounts when a Google displayName is set — honest
  // limitation of the existing data, reported, not papered over.
  const interviewerRows = useMemo(() => {
    const todayKey = new Date().toDateString();
    return interviewers.map((iv) => {
      const email = (iv.email || "").toLowerCase();
      let todayCount = 0;
      let last = null;
      for (const c of candidates) {
        if ((c.lastUpdatedBy || "").toLowerCase() !== email) continue;
        const at = toDate(c.lastUpdatedAt);
        if (!at) continue;
        if (at.toDateString() === todayKey) todayCount += 1;
        if (!last || at > last.at) last = { name: c.name || c.regNo, at };
      }
      const lastActiveDate = toDate(iv.lastActive);
      return {
        email: iv.email,
        lastActiveMs: lastActiveDate ? lastActiveDate.getTime() : null,
        todayCount,
        lastTouchedName: last ? last.name : null,
      };
    });
  }, [interviewers, candidates]);

  // §7.7 activity items — last 15 candidate writes, derived CLIENT-SIDE
  // from the existing candidates snapshot sorted by lastUpdatedAt. No new
  // listeners; verdict summary reuses the §7.4 display-only domain join.
  const activityItems = useMemo(
    () =>
      candidates
        .filter((c) => c.lastUpdatedAt)
        .map((c) => {
          const domains = verdictDomains(c);
          const at = toDate(c.lastUpdatedAt);
          return {
            regNo: c.regNo,
            name: c.name || c.regNo,
            summary:
              domains.length > 0 ? `Selected · ${domains.join(" + ")}` : "updated",
            by: c.lastUpdatedBy || "",
            at: c.lastUpdatedAt,
            sortMs: at ? at.getTime() : 0,
          };
        })
        .sort((a, b) => b.sortMs - a.sortMs)
        .slice(0, 15),
    [candidates]
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

  // ---------- §7.5 drawer wiring ----------
  const drawerCandidate = useMemo(
    () =>
      drawerRegNo
        ? candidates.find((c) => c.regNo === drawerRegNo) || null
        : null,
    [candidates, drawerRegNo]
  );

  const openDrawer = useCallback((candidate) => {
    setDrawerRegNo(candidate.regNo);
    setDrawerOpen(true);
  }, []);

  // Keep drawerRegNo through the exit animation (the Drawer needs the
  // candidate to render while translating out); focus restore to the row
  // is the focus trap's job.
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // If the open candidate vanishes from the snapshot (deleted), close.
  useEffect(() => {
    if (drawerOpen && drawerRegNo && candidatesReady && !drawerCandidate) {
      setDrawerOpen(false);
    }
  }, [drawerOpen, drawerRegNo, candidatesReady, drawerCandidate]);

  const reverseCandidate = useMemo(
    () =>
      reverseRegNo
        ? candidates.find((c) => c.regNo === reverseRegNo) || null
        : null,
    [candidates, reverseRegNo]
  );

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
        exportBusy={isExporting}
        filtersActive={filtersActive}
        totalCount={total}
        filteredCount={filteredCandidates.length}
        onForceLogout={() => setShowForceLogoutModal(true)}
        onDangerReset={() => setShowClearDataModal(true)}
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
          onOpenRow={openDrawer}
          selectedRegNo={drawerOpen ? drawerRegNo : null}
          scrollRef={tableCardRef}
          filterKey={`${search}|${filterPaid}`}
          formatWhen={(stamp) => formatRelativeTime(toDate(stamp))}
        />

        {/* §7.6 interviewers panel + §7.7 live activity — two columns ≥ 1280,
            stacked below (the always-green Vault presence card dies here) */}
        <div className="admin-panels">
          <AdminInterviewers
            rows={interviewerRows}
            ready={candidatesReady}
            onEndSession={endInterviewerSession}
            endingEmail={endingSessionEmail}
          />
          <AdminActivity
            items={activityItems}
            ready={candidatesReady}
            formatWhen={(stamp) => formatRelativeTime(toDate(stamp))}
          />
        </div>
      </main>

      {/* §7.5 candidate drawer — verify next to the evidence + reverse */}
      <AdminCandidateDrawer
        open={drawerOpen}
        candidate={drawerCandidate}
        onClose={closeDrawer}
        onVerify={handleVerifyConfirmed}
        onReverse={(candidate) => setReverseRegNo(candidate.regNo)}
        formatWhen={(stamp) => formatRelativeTime(toDate(stamp))}
      />

      {/* §7.5 reverse verification — new Dialog, busy-held (§2 #38) */}
      <Dialog
        open={reverseRegNo != null}
        onClose={() => setReverseRegNo(null)}
        title="Reverse verification"
        danger
        busy={isReversing}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={isReversing}
              onClick={() => setReverseRegNo(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              loading={isReversing}
              onClick={confirmReverseVerification}
            >
              Reverse
            </Button>
          </>
        }
      >
        <p>
          Mark {reverseCandidate ? reverseCandidate.name : 'this candidate'}
          &#8217;s payment as unverified again (clears verified-by and
          verified-at). The payment claim itself is kept.
        </p>
      </Dialog>

      {/* §7.8 danger zone — amber Reset (type RESET), busy holds open */}
      <Dialog
        open={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        title="Reset interview data"
        danger
        busy={isClearDataLoading}
        className="admin-dialog--warn"
        typedConfirm={{ word: 'RESET' }}
        actions={({ confirmEnabled }) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={isClearDataLoading}
              onClick={() => setShowClearDataModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="admin-btn--warn"
              disabled={!confirmEnabled}
              loading={isClearDataLoading}
              onClick={clearAllInterviewerData}
            >
              Reset interview data
            </Button>
          </>
        )}
      >
        <p>
          Clears all verdicts, payment confirmations, and comments.
          All candidate records are kept.
        </p>
      </Dialog>

      {/* §7.8 danger zone — red Delete ALL (type DELETE), busy holds open */}
      <Dialog
        open={showDeleteDataModal}
        onClose={() => setShowDeleteDataModal(false)}
        title="Delete ALL candidate data"
        danger
        busy={isDeleteDataLoading}
        typedConfirm={{ word: 'DELETE' }}
        actions={({ confirmEnabled }) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={isDeleteDataLoading}
              onClick={() => setShowDeleteDataModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!confirmEnabled}
              loading={isDeleteDataLoading}
              onClick={clearAllCandidateData}
            >
              Delete ALL data
            </Button>
          </>
        )}
      >
        <p>
          Permanently deletes every candidate record and payment session
          from the database. This cannot be undone.
        </p>
      </Dialog>

      {/* §7.6 / §2 #38: plain confirm (recoverable — no typed confirm),
          stating the count; busy holds open until the deletes resolve */}
      <Dialog
        open={showForceLogoutModal}
        onClose={() => setShowForceLogoutModal(false)}
        title="Force logout all"
        danger
        busy={isForceLogoutLoading}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={isForceLogoutLoading}
              onClick={() => setShowForceLogoutModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              loading={isForceLogoutLoading}
              onClick={forceLogoutAllInterviewers}
            >
              End sessions
            </Button>
          </>
        }
      >
        <p>
          End all {interviewers.length} interviewer{' '}
          {interviewers.length === 1 ? 'session' : 'sessions'}? Interviewers
          will need to sign in again.
        </p>
      </Dialog>

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
