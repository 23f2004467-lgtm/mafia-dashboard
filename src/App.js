import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { auth, provider, db } from "./firebaseConfig";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  deleteField
} from "firebase/firestore";
import QRCode from 'react-qr-code';
import { FirebaseSecurity } from './security';
import { buildCandidatePayload } from './candidatePayload';
import { buildPaymentClaim } from './paymentClaim';
import {
  deriveVerdictStatusForWrite,
  isWaiting,
  compareByActivatedAt,
} from './candidateState';
import { canUndo } from './undoGuard';
import { ConfirmSheet, ToastHost, toast } from './ui';
import Login from './screens/interviewer/Login';
import Search from './screens/interviewer/Search';
import Candidate from './screens/interviewer/Candidate';
import Payment from './screens/interviewer/Payment';
import Done from './screens/interviewer/Done';
import InterviewerChrome, { ScreenEnter } from './screens/interviewer/Chrome';
import Desk from './screens/desk/Desk';
import {
  throttle,
  DataCache,
  PerformanceMonitor,
  ConnectionPool,
  MemoryManager,
  AdvancedRateLimiter
} from './performanceOptimizations';

// UPI config - using Bhuta's and Dheera's UPI IDs
// TODO: might need to add more UPI IDs later if we get more payment handlers
const UPI_CONFIG = {
  upiIds: [
    {
      id: "bhutakeyur0208@okhdfcbank",
      name: "Bhuta's UPI", 
      type: "HDFC Bank"
    },
    {
      id: "dheera1312@oksbi",
      name: "Dheera's UPI",
      type: "SBI Bank"
    }
  ],
  merchantName: "MAFIA Recruitments",
  merchantCode: "MAFIA2025" // for tracking payments
};

// Cash is a first-class rail at events (owner truth #4, 2026-07-20): the
// Payment ACCOUNT zone offers a third card, Cash, below the two UPI cards.
// UPI_CONFIG.upiIds stays the QR source of truth (cash has NO QR); the
// combined PAYMENT_ACCOUNTS is what the ACCOUNT zone renders and what the
// selectedUpiId index addresses (cash is the last index). The `cash` flag is
// the single marker Payment.jsx keys off to drop the QR zone and relabel the
// hold, and confirmManualPaid keys off to stamp method "Cash" vs the UPI label.
const CASH_ACCOUNT = {
  id: "cash",
  name: "Cash",
  type: "Collected in person",
  cash: true,
};
const PAYMENT_ACCOUNTS = [...UPI_CONFIG.upiIds, CASH_ACCOUNT];

// Client-side candidate filter (§2 #21): case-insensitive name substring OR
// regNo prefix over the app-level in-memory candidates array. Pure; min-2-chars
// gating is the callers' job.
const filterCandidates = (candidates, queryText) => {
  const q = queryText.trim().toLowerCase();
  return candidates.filter(
    (candidate) =>
      candidate.name?.toLowerCase().includes(q) ||
      candidate.regNo?.toLowerCase().startsWith(q)
  );
};

// Maps FirebaseSecurity.validator.validateCandidateData's exact message
// strings (validation logic untouched, §2 #43) to Candidate-screen fields so
// they render as inline errors instead of the deleted native dialogs.
const SECURITY_ERROR_FIELDS = {
  'Invalid name': 'name',
  'Invalid registration number': 'regNo',
  'Invalid year': 'year',
  'Invalid phone number': 'whatsappNumber',
  'College name too long': 'college',
  'Branch name too long': 'branch',
  'Comments too long': 'comments',
};

// "My recent" storage (§6.2): last 5 candidates this interviewer touched.
const RECENTS_KEY = "mafia.recentCandidates";

const readRecents = () => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// §2 #20: last-used UPI account per interviewer (both cards stay visible).
const LAST_UPI_KEY = "mafia.lastUpiAccount";

const readLastUpiAccount = (count) => {
  try {
    const stored = parseInt(localStorage.getItem(LAST_UPI_KEY), 10);
    return Number.isInteger(stored) && stored >= 0 && stored < count
      ? stored
      : 0;
  } catch {
    return 0;
  }
};

// Landmine #5 (§2 #17): the live QR payment session is persisted (state +
// sessionStorage) so "Show QR" is idempotent per candidate — re-entering
// the screen (or reloading) reuses the same session/verification code
// without burning a generation attempt.
const PAYMENT_SESSION_KEY = "mafia.paymentSession";

const readStoredPaymentSession = () => {
  try {
    const raw = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.paymentId && parsed.regNo ? parsed : null;
  } catch {
    return null;
  }
};

function App() {
  // Performance stuff - added this because the site was getting slow with multiple users
  const performanceMonitor = useMemo(() => new PerformanceMonitor(), []);
  const dataCache = useMemo(() => new DataCache(50), []);
  const connectionPool = useMemo(() => new ConnectionPool(), []);
  const memoryManager = useMemo(() => new MemoryManager(), []);
  const rateLimiter = useMemo(() => new AdvancedRateLimiter(), []);

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("formData");
    return saved
      ? JSON.parse(saved)
      : {
          name: "",
          regNo: "",
          year: "",
          college: "",
          branch: "",
          whatsappNumber: "",
          preferences: {
            talentComm: {
              pref1: "",
              pref2: ""
            },
            workComm: {
              pref1: "",
              pref2: "",
              pref3: ""
            }
          },
          verdict: {
            talentComm: [],
            workComm: [],
          },
          comments: "",
          paid: false,
          paymentDetails: null,
          lastUpdatedBy: "",
          lastUpdatedAt: ""
        };
  });

  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  // The app-level in-memory candidates array (sanctioned exception d, §13 3b).
  // Fed by the ONE candidates onSnapshot below; docs keep their Firestore doc
  // id alongside their data. All search is a client-side filter over this.
  const [candidates, setCandidates] = useState([]);
  // True once the first candidates snapshot has arrived (drives the §6.2
  // skeleton-grace loading state; reset on sign-out).
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  // The §6 screen state machine. Route "/" stays; screens are presentational
  // components — all Firebase handlers remain here in App.js.
  const [screen, setScreen] = useState("login"); // login|search|candidate|payment|done
  // False until the first onAuthStateChanged callback fires on cold load;
  // while false, "/" shows the §6.1 boot splash (never the login form), so
  // restored sessions go splash → Search and never see Login.
  const [authResolved, setAuthResolved] = useState(false);
  // Inline login error (§6.1): the mapped message from the existing error
  // table in login() renders as a Banner on the Login screen — never a
  // native dialog.
  const [loginError, setLoginError] = useState("");
  // Connection dot state for the global chrome (§6).
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  // "My recent" (§6.2): last 5 candidates touched, persisted per device.
  const [recents, setRecents] = useState(readRecents);
  // §2 #45: Search autofocuses ONLY when arriving via "Next candidate"
  // (set there, cleared on every other way out of Search — cold load and
  // back-navigation never autofocus).
  const [searchAutoFocus, setSearchAutoFocus] = useState(false);
  // ---------- Check-in desk role (owner feature 2026-07-20) ----------
  // The desk allowlist from config/checkinDesk { emails: [...] } (live
  // onSnapshot below; admin manages the list from the /admin overflow).
  // `deskRoleLoaded` gates the signed-in render: until the first snapshot
  // (or its error fallback) arrives, "/" holds the boot splash so a desk
  // user NEVER flashes the interviewer state machine (and vice versa).
  const [deskEmails, setDeskEmails] = useState([]);
  const [deskRoleLoaded, setDeskRoleLoaded] = useState(false);
  // Doc key of the desk check-in write in flight (button loading state).
  const [deskBusyKey, setDeskBusyKey] = useState(null);
  // §6.5: the Done screen's recap ({name, verdict, paid, manuallyVerified}),
  // latched from formData BEFORE the routed reset (resetAfterSubmit /
  // clearForm) wipes it — the recap is display-local, like §2 #30's
  // "Not selected" state.
  const [doneRecap, setDoneRecap] = useState(null);
  // Owner decision (2026-07-20): the verdict-submit undo is a PERSISTENT
  // "Undo verdict" button on the Done screen — the 10 s toast countdown is
  // gone (admin's verify toasts are untouched). This is the capability:
  // {docKey, regNo, snapshot, writtenMeta, name, form, notSelected,
  // isManualEntry}, captured by performSubmit for existing docs. Alive only
  // while the interviewer is still looking at the result (Done, or the
  // routed Payment screen for that candidate); cleared by every route away
  // and by ANY payment activity for that candidate. In-memory only — a
  // reload drops it, exactly as the old toast did.
  const [verdictUndo, setVerdictUndo] = useState(null);

  // Route-away clear: leaving the done/payment context abandons the
  // capability (Next candidate, opening a candidate or walk-in or draft,
  // back to Search, sign-out, chip-hop to another candidate's payment).
  const clearVerdictUndo = () => setVerdictUndo(null);

  // THE PAYMENT HAZARD: the captured snapshot predates payment writes —
  // undoing after one would wipe the candidate's payment fields
  // (paid/paymentDetails). Any payment activity for the capability's
  // candidate (QR session created, manual mark-paid, payment-confirmed
  // poll event) kills the offer here; the undoGuard stale-check stays as
  // the second line of defense regardless. Functional update so interval
  // closures (the 30 s poll) always see the fresh capability.
  const clearVerdictUndoFor = (...candidateKeys) => {
    const keys = candidateKeys.filter(Boolean);
    if (keys.length === 0) return;
    setVerdictUndo((prev) =>
      prev && keys.some((k) => k === prev.regNo || k === prev.docKey)
        ? null
        : prev
    );
  };
  // Landmine #2 prep: the Firestore doc key of the loaded candidate is
  // captured HERE at load time. 3d's submit path must use this ref, never
  // live formData.regNo.
  const candidateDocKeyRef = useRef(null);
  const [paymentAmount] = useState("300"); // Fixed at ₹300
  const [paymentStatus, setPaymentStatus] = useState("pending"); // pending, completed, cancelled, timeout, error
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [lastTransactionCheck, setLastTransactionCheck] = useState(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePaymentSessions, setActivePaymentSessions] = useState(new Set());
  const [rateLimitCount, setRateLimitCount] = useState(0);
  const [lastQRGeneration, setLastQRGeneration] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  // §2 #30: "Not selected" is display-local only (no DB field pre-Phase-7).
  // Mutually exclusive with domain selections (§2 #10, confirmed in-screen).
  const [notSelected, setNotSelected] = useState(false);
  // Inline submit validation errors ({field: message}) — replaces the
  // deleted native validation dialogs (§6.3: inline errors, never modal).
  const [submitErrors, setSubmitErrors] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // §6.6 / sanctioned exception (e): the walk-in native-confirm guard
  // becomes a ConfirmSheet — same condition, same write.
  const [walkInConfirmOpen, setWalkInConfirmOpen] = useState(false);
  // §2 #20: index of selected UPI ID, last-used preselected per device.
  const [selectedUpiId, setSelectedUpiId] = useState(() =>
    readLastUpiAccount(PAYMENT_ACCOUNTS.length)
  );
  // Landmine #5: the ONE live QR payment session
  // ({regNo, name, docKey, paymentId, verificationCode, createdAt,
  // qrString, upiId}), mirrored to sessionStorage.
  const [paymentSession, setPaymentSession] = useState(readStoredPaymentSession);
  // Which candidate the Payment screen is currently about (regNo): set on
  // submit-routing and on pending-chip taps. Normally === formData.regNo;
  // it differs only when the chip re-enters a live session after another
  // candidate was opened (the form draft is then left untouched).
  const [paymentFor, setPaymentFor] = useState(null);
  // §6.4 green room takeover payload ({name, regNo, txn, manual}); null idle.
  const [greenRoom, setGreenRoom] = useState(null);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);
  // Poll intervals already started this app session — the idempotent
  // "Show QR" never double-polls; a reload clears this so a restored
  // session restarts its 30 s poll.
  const pollStartedRef = useRef(new Set());
  // Fresh values for the poll-interval closures (they would otherwise
  // capture render-time state from when the QR was generated).
  const liveRef = useRef({
    screen: "login",
    formData: null,
    candidates: [],
    paymentFor: null,
    paymentSession: null,
  });

  // Initialize security system
  useEffect(() => {
    // Initialize security monitoring
    FirebaseSecurity.auditLogger.logEvent('app_initialized', {
      timestamp: new Date().toISOString()
    });
  }, []);

  // Tracks whether the post-login session registration has run for the
  // current signed-in session (popup OR restored). Check-and-set is atomic
  // within a synchronous block, so whichever path claims it first wins and
  // the other skips — setup runs exactly once per session. Reset when auth
  // state goes null so the next sign-in re-runs setup.
  const postLoginSetupDoneRef = useRef(false);

  // Auth hydration (sanctioned exception a): restore signed-in sessions
  // across reloads. A restored session runs the SAME post-login setup as the
  // popup path — interviewer session registration here, and the 10-min
  // lastActive heartbeat via the user-keyed effect below (it starts whenever
  // `user` becomes set, from either path). Rate-limit/lockout checks stay on
  // the popup path only: they gate attempts, not restores.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Signed out (logout here or revoked elsewhere): allow the next
        // sign-in to re-run setup. The heartbeat interval is cleared by its
        // own effect cleanup when `user` becomes null. The listener itself
        // stays registered for future sign-ins.
        postLoginSetupDoneRef.current = false;
        setUser(null);
        setScreen("login");
        setSearchAutoFocus(false); // next session's Search is a cold load
        setDoneRecap(null);
        clearVerdictUndo(); // sign-out leaves the done/payment context
        setAuthResolved(true);
        return;
      }

      // Mirror the popup path's email validation; never hydrate a session
      // whose email fails it.
      if (!FirebaseSecurity.utils.validateEmail(firebaseUser.email)) {
        setAuthResolved(true);
        return;
      }

      setUser(firebaseUser);
      // Signed in (popup or restored): land on Search. Functional update so
      // a listener re-fire mid-interview never yanks the screen back.
      setScreen((s) => (s === "login" ? "search" : s));
      setAuthResolved(true);

      // Once-per-session guard: skip if the popup path already ran (or has
      // claimed) session registration.
      if (postLoginSetupDoneRef.current) return;
      postLoginSetupDoneRef.current = true;

      try {
        // Same interviewer session registration the popup path performs.
        const interviewerRef = doc(db, "interviewers", firebaseUser.email);
        await setDoc(interviewerRef, {
          email: firebaseUser.email,
          loginTime: serverTimestamp(),
          lastActive: serverTimestamp(),
          displayName: firebaseUser.displayName || firebaseUser.email
        });
      } catch (error) {
        // Non-fatal: the heartbeat effect writes lastActive with merge, so
        // presence still surfaces even if this registration write fails.
        console.error("Error registering restored session:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Connection dot (§6 global chrome): navigator.onLine listeners feeding
  // the green "Synced" / amber "Offline" indicator in the TopBar.
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Mirror the states the payment poll's interval closures need fresh
  // (no dep array: runs after every render; refs never re-trigger renders).
  useEffect(() => {
    liveRef.current = {
      screen,
      formData,
      candidates,
      paymentFor,
      paymentSession,
    };
  });

  // §2 #20: selecting a UPI account persists it as the device's last-used.
  const selectUpiAccount = (index) => {
    setSelectedUpiId(index);
    try {
      localStorage.setItem(LAST_UPI_KEY, String(index));
    } catch (error) {
      console.warn("Failed to save UPI preference:", error);
    }
  };

  // Optimized form data saving with throttling
  const throttledSaveFormData = useCallback(
    throttle((data) => {
      try {
        localStorage.setItem("formData", JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save form data:', error);
      }
    }, 1000), // Save at most once per second
    []
  );

  useEffect(() => {
    throttledSaveFormData(formData);
  }, [formData, throttledSaveFormData]);

  // Optimized interviewer session update
  useEffect(() => {
    if (!user || !user.email) return;

    const updateLastActive = async () => {
      try {
        // Check rate limit
        if (!rateLimiter.isAllowed(`session_${user.email}`)) {
          return;
        }

        const interviewerRef = doc(db, "interviewers", user.email);
        await connectionPool.execute(() => setDoc(interviewerRef, {
          email: user.email,
          lastActive: serverTimestamp(),
          displayName: user.displayName || user.email
        }, { merge: true }));
      } catch (error) {
        console.error("Error updating lastActive:", error);
      }
    };

    // Update immediately
    updateLastActive();

    // Update every 10 minutes (reduced frequency for better performance)
    const interval = setInterval(updateLastActive, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, rateLimiter, connectionPool]);

  // The ONE candidates listener (sanctioned exception d, §13 3b): a single
  // app-level onSnapshot opened once per signed-in session (popup or 3a
  // hydration — both set `user`), unsubscribed by this effect's cleanup when
  // `user` goes null (logout) or the app unmounts. The old per-press search
  // onSnapshot and the broken first-10-docs debounced search are deleted.
  useEffect(() => {
    if (!user || !user.email) {
      setCandidates([]);
      setCandidatesLoaded(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "candidates"),
      (snapshot) => {
        setCandidates(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );
        setCandidatesLoaded(true);
      },
      (error) => {
        console.error("Candidates listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // The check-in desk role listener (owner feature 2026-07-20): one live
  // single-doc onSnapshot on config/checkinDesk per signed-in session.
  // Additive schema — the doc missing entirely (or unreadable under the
  // rules) resolves to an empty allowlist and the interviewer portal, which
  // is exactly today's behavior for every existing account. Emails compare
  // case-insensitively.
  useEffect(() => {
    if (!user || !user.email) {
      setDeskEmails([]);
      setDeskRoleLoaded(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "config", "checkinDesk"),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const emails = Array.isArray(data && data.emails) ? data.emails : [];
        setDeskEmails(
          emails
            .filter((e) => typeof e === "string")
            .map((e) => e.trim().toLowerCase())
        );
        setDeskRoleLoaded(true);
      },
      (error) => {
        // Unreadable config (rules/offline): fall back to the interviewer
        // portal — permissive for the many, never a locked door.
        console.error("Check-in desk config listener error:", error);
        setDeskEmails([]);
        setDeskRoleLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Live search (§13 3b): fresh 250 ms debounce, min 2 chars, filtering the
  // in-memory candidates array client-side. Results also refresh when the
  // snapshot updates (candidates dep) — no per-keystroke reads.
  useEffect(() => {
    const q = searchName.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearchResults(filterCandidates(candidates, q));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchName, candidates]);

  // QR Code and Payment Verification Functions
  const generateQRCode = useCallback(async () => {
    if (isGeneratingQR) {
      return; // Prevent multiple simultaneous generations
    }

    // No QR for cash (owner truth #4): the cash rail is confirmed by the
    // hold-to-confirm alone. The Payment screen already hides Show QR /
    // Regenerate when cash is selected; this guard is defense-in-depth so a
    // persisted cash selection (selectedUpiId past the UPI list) can never
    // index into createPaymentSession's UPI_CONFIG.upiIds[selectedUpiId].
    if (!UPI_CONFIG.upiIds[selectedUpiId]) {
      return;
    }

    // Check rate limit
    if (!rateLimiter.isAllowed(`qr_${user?.email || 'anonymous'}`)) {
      setErrorMessage('Too many QR code generations. Please wait before trying again.');
      return;
    }

    setIsGeneratingQR(true);
    setErrorMessage("");

    try {
      const startTime = performanceMonitor.startTimer();

      // Validate form data
      if (!formData.regNo || !formData.name) {
        throw new Error('Please fill in candidate details before generating QR code');
      }

      // Debug - checking which UPI was selected
      console.log('Selected UPI ID:', selectedUpiId);
      console.log('Selected UPI:', UPI_CONFIG.upiIds[selectedUpiId]);

      // Create unique payment session for this candidate
      const sessionData = await connectionPool.execute(() => 
        createPaymentSession(formData.regNo, formData.name)
      );

      // Generate proper UPI payment URL using selected UPI ID
      const selectedUpi = UPI_CONFIG.upiIds[selectedUpiId];
      
      // Validate UPI ID
      if (!selectedUpi || !selectedUpi.id) {
        throw new Error(`Invalid UPI ID selected: ${selectedUpiId}`);
      }
      
      // Validate UPI ID format
      if (!selectedUpi.id.includes('@')) {
        throw new Error(`Invalid UPI ID format: ${selectedUpi.id}`);
      }
      
      const qrString = `upi://pay?pa=${selectedUpi.id}&pn=${encodeURIComponent(UPI_CONFIG.merchantName)}&am=${paymentAmount}&tn=MAFIA_${formData.regNo}_${sessionData.verificationCode}&cu=INR`;
      
      console.log('Generated QR String:', qrString);
      console.log('Payment Session Data:', sessionData);
      
      setQrCodeData(qrString);
      setVerificationCode(sessionData.verificationCode);
      setShowQRCode(true);
      setPaymentStatus("pending");

      // Landmine #5: persist the live session (state + sessionStorage) so
      // "Show QR" stays idempotent for this candidate — reuse never burns
      // a generation attempt. (§2 #19: the old 20-min countdown headline
      // and its timer are deleted; the timeout banner carries tries left.)
      const sessionRecord = {
        regNo: formData.regNo,
        name: formData.name,
        docKey: candidateDocKeyRef.current || formData.regNo,
        paymentId: sessionData.paymentId,
        verificationCode: sessionData.verificationCode,
        createdAt: sessionData.createdAt,
        qrString,
        upiId: selectedUpi.id,
      };
      setPaymentSession(sessionRecord);
      try {
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(sessionRecord));
      } catch (storageError) {
        console.warn('Failed to persist payment session:', storageError);
      }

      // Payment activity — QR session created for this candidate: the
      // Done-screen undo capability (if it is his) dies here (owner
      // decision 2026-07-20). Inline setter, not clearVerdictUndoFor, so
      // this useCallback's dependency warning set stays byte-identical.
      setVerdictUndo((prev) =>
        prev &&
        (prev.regNo === sessionRecord.regNo ||
          prev.docKey === sessionRecord.docKey)
          ? null
          : prev
      );

      // Start automatic verification
      startPaymentVerification(sessionData.paymentId);

      const generationTime = performanceMonitor.endTimer(startTime);
      performanceMonitor.logMetric('qrGenerationTime', generationTime);
      
      // QR Code generated successfully - session data logged securely
    } catch (error) {
      console.error('Error generating QR code:', error);
      console.error('Error details:', {
        selectedUpiId,
        selectedUpi: UPI_CONFIG.upiIds[selectedUpiId],
        formData: { regNo: formData.regNo, name: formData.name },
        user: user?.email
      });
      // Inline red Banner + Retry on the Payment screen — never a native dialog
      setErrorMessage(error.message);
    } finally {
      setIsGeneratingQR(false);
    }
  }, [isGeneratingQR, rateLimiter, user, formData, selectedUpiId, paymentAmount, performanceMonitor, connectionPool]);

  const startPaymentVerification = (paymentId) => {
    // Dedupe guard (landmine #5): the poll lives at App level and survives
    // screen changes — the idempotent "Show QR" must never start a second
    // interval for a session that is already being checked. After a page
    // reload the set is empty, so a restored session restarts its poll.
    if (pollStartedRef.current.has(paymentId)) return;
    pollStartedRef.current.add(paymentId);
    // Start checking for payment using the unique payment ID
    checkPaymentStatus(paymentId);
  };

  const checkPaymentStatus = async (paymentId) => {
    const maxAttempts = RATE_LIMIT.MAX_CHECK_ATTEMPTS;
    let attempts = 0;
    let lastError = null;
    
    console.log('Starting payment verification for:', paymentId);
    
    const checkInterval = setInterval(async () => {
      attempts++;
      
      try {
        // Check Firebase for payment confirmation
        const ref = doc(db, 'paymentSessions', paymentId);
        const docSnap = await getDoc(ref);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Update last checked time
          await setDoc(ref, { ...data, lastChecked: new Date().toISOString() }, { merge: true });
          // Feed the §6.4 ticking "last check m:ss" line (§2 #19) — local
          // display state only, no write change.
          setLastTransactionCheck(new Date());

          if (data.status === 'completed') {
            clearInterval(checkInterval);
            setPaymentStatus("completed");
            // Payment-confirmed event: the Done-screen undo capability for
            // this candidate dies here — persistPaymentToCandidate below
            // writes payment truth the captured snapshot predates (owner
            // decision 2026-07-20). Functional clear: this interval closure
            // was created at QR-generation time.
            clearVerdictUndoFor(data.candidateId);
            const paymentDetails = {
              transactionId: data.transactionId || paymentId,
              amount: paymentAmount,
              timestamp: new Date().toISOString(),
              method: `${UPI_CONFIG.upiIds[selectedUpiId].type} QR (${UPI_CONFIG.upiIds[selectedUpiId].name})`,
              verificationCode: data.verificationCode,
              paymentId: paymentId,
              verified: true,
              upiId: data.upiId || UPI_CONFIG.upiIds[selectedUpiId].id,
              upiName: data.upiName || UPI_CONFIG.upiIds[selectedUpiId].name,
              upiType: data.upiType || UPI_CONFIG.upiIds[selectedUpiId].type
            };
            // Fresh state via liveRef: this interval closure was created at
            // QR-generation time and its captured state may be stale.
            const {
              formData: fdNow,
              candidates: candsNow,
              screen: screenNow,
              paymentFor: payForNow,
              paymentSession: sessionNow,
            } = liveRef.current;
            const isCurrentForm = !!(fdNow && fdNow.regNo === data.candidateId);
            if (isCurrentForm) {
              // The existing local mark: the loaded form flips paid.
              setFormData(prev => ({ ...prev, paid: true, paymentDetails }));
            }
            setShowQRCode(false);
            setActivePaymentSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(paymentId);
              return newSet;
            });
            if (sessionNow && sessionNow.paymentId === paymentId) {
              clearPaymentSessionState();
            }
            // Persist the confirmed payment onto the candidate doc through
            // the SAME write path submit uses. The §6.3 submit already wrote
            // this doc with paid:false before routing here — in the old
            // single-page flow the interviewer pressed Submit after the QR
            // confirmed, which is the write this re-issues.
            let base = null;
            let baseDocKey = null;
            if (isCurrentForm) {
              base = fdNow;
              baseDocKey = candidateDocKeyRef.current || fdNow.regNo;
            } else {
              const liveDoc = (candsNow || []).find(
                (c) => c.regNo === data.candidateId || c.id === data.candidateId
              );
              if (liveDoc) {
                const { id: _docId, ...rest } = liveDoc;
                base = rest;
                baseDocKey = liveDoc.id || liveDoc.regNo;
              }
            }
            if (base) {
              persistPaymentToCandidate(
                { ...base, paid: true, paymentDetails },
                baseDocKey
              );
            }
            const confirmedName =
              data.candidateName || (base && base.name) || data.candidateId;
            if (screenNow === "payment" && payForNow === data.candidateId) {
              // §9 #10: the green room takeover (payment screen only).
              setGreenRoom({
                name: confirmedName,
                regNo: data.candidateId,
                txn: paymentDetails.transactionId,
                manual: false,
              });
            } else {
              // Confirmed while on another screen: green toast, chip clears.
              toast({
                tone: "success",
                message: `Payment received — ${confirmedName} ₹300`,
              });
            }
            return;
          }

          // Check if payment was cancelled
          if (data.status === 'cancelled') {
            clearInterval(checkInterval);
            setPaymentStatus("cancelled");
            setShowQRCode(false);
            setActivePaymentSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(paymentId);
              return newSet;
            });
            const { paymentSession: sessionNow } = liveRef.current;
            if (sessionNow && sessionNow.paymentId === paymentId) {
              clearPaymentSessionState();
            }
            return;
          }
        } else {
          // Document doesn't exist, payment session was deleted
          clearInterval(checkInterval);
          setPaymentStatus("error");
          setErrorMessage("Payment session not found");
          return;
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setPaymentStatus("timeout");
          setErrorMessage("Payment verification timeout. Please confirm below if it landed.");
          console.log('Payment verification timeout for:', paymentId);
          // Don't hide QR code on timeout - let user verify manually
          // setShowQRCode(false); // Removed this line
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        lastError = error;
        
        // If we get too many consecutive errors, stop checking but don't hide QR
        if (attempts >= 5 && lastError) {
          clearInterval(checkInterval);
          setPaymentStatus("error");
          setErrorMessage("Payment verification failed due to network issues. You can still confirm below.");
          console.log('Payment verification error for:', paymentId, 'Error:', lastError);
          // Don't hide QR code on error - let user verify manually
          // setShowQRCode(false); // Removed this line
        }
      }
    }, RATE_LIMIT.PAYMENT_CHECK_INTERVAL);
    
    setLastTransactionCheck(new Date());
  };

  // §2 #14: simulateManualVerification (the accept-any-6-chars fraud stub)
  // and its verifyPaymentManually UI path are DELETED outright. Manual
  // mark-paid lives behind "Other options" (§2 #15) below.

  // Cleanup function for payment sessions
  const cleanupPaymentSession = async (paymentId) => {
    try {
      const ref = doc(db, 'paymentSessions', paymentId);
      await setDoc(ref, { status: 'cancelled', cancelledAt: new Date().toISOString() }, { merge: true });
      setActivePaymentSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
    } catch (error) {
      console.error('Error cleaning up payment session:', error);
    }
  };

  // Landmine #5: drop the persisted live-session record (state +
  // sessionStorage) once its payment completes or is cancelled — the
  // pending chip clears with it.
  const clearPaymentSessionState = () => {
    setPaymentSession(null);
    try {
      sessionStorage.removeItem(PAYMENT_SESSION_KEY);
    } catch (error) {
      console.warn('Failed to clear payment session:', error);
    }
  };

  // Re-issues the candidate setDoc through the SAME write path as submit
  // (buildCandidatePayload + captured doc key). Required by the §6.3→§6.4
  // routing: submit writes the doc paid:false BEFORE payment; in the old
  // single-page flow the payment reached Firestore because the interviewer
  // pressed Submit after the QR confirmed — this is that same write,
  // triggered by the confirmation instead.
  const persistPaymentToCandidate = async (dataWithPayment, docKey) => {
    try {
      const key = docKey || candidateDocKeyRef.current || dataWithPayment.regNo;
      if (!key) return;
      const ref = doc(db, "candidates", key);
      const payload = buildCandidatePayload(dataWithPayment, {
        docKey: key,
        nowIso: new Date().toISOString(),
        userEmail: user?.email,
      });
      await setDoc(ref, payload);
      FirebaseSecurity.auditLogger.logEvent('candidate_data_saved', {
        candidateId: dataWithPayment.regNo,
        interviewer: user?.email
      });
    } catch (error) {
      toast({
        tone: "error",
        message: "Payment recorded but not saved to the candidate: " + error.message,
      });
    }
  };

  // Reset rate limit after some time
  useEffect(() => {
    const resetTimer = setTimeout(() => {
      setRateLimitCount(0);
    }, 60000); // Reset after 1 minute

    return () => clearTimeout(resetTimer);
  }, [rateLimitCount]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cancel all active payment sessions
      activePaymentSessions.forEach(paymentId => {
        cleanupPaymentSession(paymentId);
      });
      
      // Cleanup performance optimizations
      memoryManager.destroy();
      dataCache.clear();
      rateLimiter.cleanup();
    };
  }, [activePaymentSessions, memoryManager, dataCache, rateLimiter]);

  // (§12/§9: the runtime <style> spinner injection is deleted — the app's
  // only keyframes, including `spin`, live in src/ui/base.css.)

  // Robust Multi-Interview Payment System
  const RATE_LIMIT = {
    QR_GENERATION: 5000, // 5 seconds between QR generations
    MAX_ATTEMPTS: 3, // Max QR generations per session
    PAYMENT_CHECK_INTERVAL: 30000, // 30 seconds between payment checks (increased)
    MAX_CHECK_ATTEMPTS: 40 // Max payment check attempts (20 minutes - increased)
  };

  const validatePaymentAmount = (amount) => {
    // Fixed payment amount of ₹300
    return 300;
  };

  const validateCandidateData = (candidateId, candidateName) => {
    if (!FirebaseSecurity.utils.validateRegNo(candidateId)) {
      throw new Error('Invalid registration number format');
    }
    if (!candidateName || candidateName.trim().length === 0) {
      throw new Error('Candidate name is required');
    }
    if (candidateName.length > 100) {
      throw new Error('Candidate name too long (max 100 characters)');
    }
    return {
      candidateId: FirebaseSecurity.validator.sanitizeInput(candidateId.trim()),
      candidateName: FirebaseSecurity.validator.sanitizeInput(candidateName.trim())
    };
  };

  const checkRateLimit = () => {
    // Check rate limit using security utilities
    if (!FirebaseSecurity.rateLimiter.checkLimit('qr_generation', RATE_LIMIT.MAX_ATTEMPTS, RATE_LIMIT.QR_GENERATION)) {
      throw new Error('Rate limit exceeded. Please wait before generating another QR code.');
    }
    
    const now = Date.now();
    const timeSinceLastGeneration = now - lastQRGeneration;
    
    if (timeSinceLastGeneration < RATE_LIMIT.QR_GENERATION) {
      const remainingTime = Math.ceil((RATE_LIMIT.QR_GENERATION - timeSinceLastGeneration) / 1000);
      throw new Error(`Please wait ${remainingTime} seconds before generating another QR code`);
    }
    
    if (rateLimitCount >= RATE_LIMIT.MAX_ATTEMPTS) {
      throw new Error('Too many QR code generation attempts. Please wait before trying again.');
    }
  };

  const generateUniquePaymentId = () => {
    const timestamp = Date.now();
    const random = FirebaseSecurity.utils.generateSecureRandom(6).toUpperCase();
    const sessionId = FirebaseSecurity.utils.generateSecureRandom(4).toUpperCase();
    return `MAFIA_${timestamp}_${random}_${sessionId}`;
  };

  const createPaymentSession = async (candidateId, candidateName) => {
    try {
      // Validate inputs
      const validatedAmount = validatePaymentAmount(paymentAmount);
      const validatedData = validateCandidateData(candidateId, candidateName);
      
      // Check rate limit
      checkRateLimit();
      
      const paymentId = generateUniquePaymentId();
      const sessionData = {
        paymentId: paymentId,
        candidateId: validatedData.candidateId,
        candidateName: validatedData.candidateName,
        amount: validatedAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        interviewerId: user?.email || 'unknown',
        verificationCode: FirebaseSecurity.utils.generateSecureRandom(6).toUpperCase(),
        retryCount: 0,
        lastChecked: new Date().toISOString(),
        upiId: UPI_CONFIG.upiIds[selectedUpiId].id,
        upiName: UPI_CONFIG.upiIds[selectedUpiId].name,
        upiType: UPI_CONFIG.upiIds[selectedUpiId].type
      };

      // Save to Firebase with retry mechanism
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          const ref = doc(db, 'paymentSessions', paymentId);
          await setDoc(ref, sessionData);
          
          // Update rate limit tracking
          setLastQRGeneration(Date.now());
          setRateLimitCount(prev => prev + 1);
          setActivePaymentSessions(prev => new Set([...prev, paymentId]));
          
          return sessionData;
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw new Error('Failed to create payment session after multiple attempts');
          }
          // Wait before retry
          const currentRetries = retries; // Capture current value
          await new Promise(resolve => setTimeout(resolve, 1000 * currentRetries));
        }
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error;
    }
  };



  const login = async () => {
    if (isLoggingIn) return;
    setLoginError("");

    // Check rate limiting — inline Banner, never a native dialog (§6.1)
    if (!FirebaseSecurity.rateLimiter.checkLimit('login', 5, 60000)) {
      setLoginError('Too many login attempts. Please try again later.');
      return;
    }

    // Check if user is locked out — inline Banner, never a native dialog (§6.1)
    if (FirebaseSecurity.sessionManager.isLockedOut('login')) {
      setLoginError('Account temporarily locked due to too many failed attempts.');
      return;
    }

    setIsLoggingIn(true);
    try {
      // Add retry logic for service unavailable errors
      let retryCount = 0;
      const maxRetries = 3;
      let lastError;

      while (retryCount < maxRetries) {
        try {
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          
          // Validate email
          if (!FirebaseSecurity.utils.validateEmail(user.email)) {
            throw new Error('Invalid email format');
          }
          
          // Track interviewer session — once per session: the auth-hydration
          // listener may have already registered it if it fired first.
          if (user && user.email && !postLoginSetupDoneRef.current) {
            postLoginSetupDoneRef.current = true;
            const interviewerRef = doc(db, "interviewers", user.email);
            await setDoc(interviewerRef, {
              email: user.email,
              loginTime: serverTimestamp(),
              lastActive: serverTimestamp(),
              displayName: user.displayName || user.email
            });
          }

          // Record successful login attempt
          FirebaseSecurity.sessionManager.recordLoginAttempt('login', true);
          FirebaseSecurity.auditLogger.logEvent('user_login_success', {
            email: user.email,
            displayName: user.displayName
          });
          
          setUser(user);
          setScreen("search");
          return; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          console.error(`Login attempt ${retryCount + 1} failed:`, error);
          
          // If it's a service unavailable error, retry after delay
          if (error.code === 'auth/the-service-is-currently-unavailable' && retryCount < maxRetries - 1) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`Service unavailable, retrying in ${delay}ms... (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // For other errors or max retries reached, break
          break;
        }
      }
      
      // If we get here, all retries failed
      throw lastError;
      
    } catch (error) {
      console.error("Login failed after all retries:", error);
      
      // Record failed login attempt
      FirebaseSecurity.sessionManager.recordLoginAttempt('login', false);
      FirebaseSecurity.auditLogger.logEvent('user_login_failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Provide user-friendly error messages
      let errorMessage = "Login failed: ";
      switch (error.code) {
        case 'auth/the-service-is-currently-unavailable':
          errorMessage += "Firebase Authentication service is temporarily unavailable. Please try again in a few minutes.";
          break;
        case 'auth/popup-closed-by-user':
          errorMessage += "Login was cancelled. Please try again.";
          break;
        case 'auth/popup-blocked':
          errorMessage += "Login popup was blocked. Please allow popups for this site and try again.";
          break;
        case 'auth/network-request-failed':
          errorMessage += "Network error. Please check your internet connection and try again.";
          break;
        case 'auth/too-many-requests':
          errorMessage += "Too many login attempts. Please wait a few minutes before trying again.";
          break;
        default:
          errorMessage += error.message;
      }

      // Inline Banner on the Login screen (§6.1) — never a native dialog
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      // Log logout event
      FirebaseSecurity.auditLogger.logEvent('user_logout', {
        email: user?.email,
        displayName: user?.displayName
      });

      // Remove interviewer session
      if (user && user.email) {
        const interviewerRef = doc(db, "interviewers", user.email);
        await setDoc(interviewerRef, {
          email: user.email,
          logoutTime: serverTimestamp(),
          lastActive: serverTimestamp()
        });
      }
      
      // Clear session data
      FirebaseSecurity.sessionManager.clearSession();
      
      // Sign out from Firebase
      await auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      
      // Log logout error
      FirebaseSecurity.auditLogger.logEvent('user_logout_error', {
        error: error.message,
        email: user?.email
      });
      
      // Still sign out even if session cleanup fails
      await auth.signOut();
      setUser(null);
    }
  };

  const handleVerdictChange = (type, domain) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.verdict[type]) ? prev.verdict[type] : [];
      const newVerdict = current.includes(domain)
        ? current.filter((d) => d !== domain)
        : [...current, domain];
      
          // Domain selection logged securely
    // Previous and new verdict logged securely
      
      return {
        ...prev,
        verdict: {
          ...prev.verdict,
          [type]: newVerdict,
        },
      };
    });
  };



  // Push a candidate onto "My recent" (§6.2): newest first, deduped by doc
  // key, capped at 5, persisted under mafia.recentCandidates.
  const pushRecent = (cand) => {
    const key = cand.id || cand.regNo;
    if (!key) return;
    setRecents((prev) => {
      const entry = {
        id: key,
        name: cand.name || "",
        regNo: cand.regNo || "",
        year: cand.year || "",
      };
      const next = [entry, ...prev.filter((r) => r.id !== key)].slice(0, 5);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Failed to save recent candidates:", error);
      }
      return next;
    });
  };

  // Open a candidate from Search (replaces the old "Load to Form" button).
  // The Firestore doc key is captured NOW (landmine #2): 3d's submit must
  // write with this key, never live formData.regNo. The doc id is stripped
  // from form state so it can never leak into the candidates write payload.
  const openCandidate = (cand) => {
    candidateDocKeyRef.current = cand.id || cand.regNo;
    const { id: _docId, ...updatedData } = cand;

    // Clear WorkComm data for 2nd year students (existing load logic;
    // non-mutating so the in-memory snapshot doc stays untouched)
    if (cand.year === "2nd Year" || cand.year === "2nd year") {
      updatedData.preferences = {
        ...(updatedData.preferences || {}),
        workComm: { pref1: "", pref2: "", pref3: "" },
      };
      updatedData.verdict = {
        ...(updatedData.verdict || {}),
        workComm: [],
      };
    }

    setFormData(updatedData);
    pushRecent(cand);
    setNotSelected(false);
    setSubmitErrors(null);
    clearVerdictUndo(); // opening a candidate leaves the done/payment context
    setSearchAutoFocus(false); // consumed — next Search visit is a back-nav
    setScreen("candidate");
  };

  // Owner-requested "Clear" on My recent (2026-07-20): wipes the persisted
  // mafia.recentCandidates list AND state, both placements (inline +
  // sidebar). No confirm — recents are a device-local convenience cache;
  // the candidate docs are untouched.
  const clearRecents = () => {
    setRecents([]);
    try {
      localStorage.removeItem(RECENTS_KEY);
    } catch (error) {
      console.warn("Failed to clear recent candidates:", error);
    }
  };

  // "My recent" tap: resolve the stored stub against the live snapshot so
  // the loaded form (and pills) carry current data.
  const openRecent = (recent) => {
    const live = candidates.find((c) => c.id === recent.id);
    if (live) {
      openCandidate(live);
    } else if (!candidatesLoaded) {
      openCandidate(recent);
    } else {
      // Loaded snapshot has no such doc (deleted since it was touched)
      setRecents((prev) => {
        const next = prev.filter((r) => r.id !== recent.id);
        try {
          localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
        } catch (error) {
          console.warn("Failed to save recent candidates:", error);
        }
        return next;
      });
    }
  };

  // Walk-in entry from Search (§6.6): Candidate screen in create mode. The
  // temp regNo is auto-generated ON ENTRY then locked (§2 #23) and becomes
  // the captured doc key.
  //
  // DISCREPANCY (reported, minimal fix): the old generator produced
  // `WALKIN_${Date.now()}`, but the PRESERVED validator
  // (SecurityUtils.validateRegNo, /^[A-Z0-9]{5,20}$/) rejects the
  // underscore — the old UI survived because regNo stayed editable; §2 #23
  // now locks it, which would make walk-in saves impossible. The generator
  // (not under §12 preservation) drops the underscore; the validator is
  // untouched.
  const startWalkIn = () => {
    const tempRegNo = `WALKIN${Date.now()}`;
    candidateDocKeyRef.current = tempRegNo; // locked post-generation (§2 #23)
    setIsManualEntry(true);
    setNotSelected(false);
    setSubmitErrors(null);
    clearVerdictUndo(); // walk-in entry leaves the done/payment context
    setSearchAutoFocus(false);
    setFormData({
      name: "",
      regNo: tempRegNo,
      year: "",
      college: "",
      branch: "",
      whatsappNumber: "",
      preferences: {
        talentComm: {
          pref1: "",
          pref2: ""
        },
        workComm: {
          pref1: "",
          pref2: "",
          pref3: ""
        }
      },
      verdict: {
        talentComm: [],
        workComm: [],
      },
      comments: "",
      paid: false,
      paymentDetails: null,
      lastUpdatedBy: user?.displayName || user?.email || "Manual Entry",
      lastUpdatedAt: new Date().toISOString()
    });
    setScreen("candidate");
  };

  // Draft resume/discard (§2 #46): the localStorage draft mechanism is
  // untouched (formData still hydrates from and throttle-saves to the
  // "formData" key) — but the draft is never silently reopened: Search
  // shows a Banner and the interviewer explicitly resumes or discards.
  const resumeDraft = () => {
    // Existing candidates are keyed by regNo, so the draft's regNo IS the
    // doc key it was loaded under.
    candidateDocKeyRef.current = formData.regNo;
    setNotSelected(false);
    setSubmitErrors(null);
    clearVerdictUndo(); // resuming a draft leaves the done/payment context
    setSearchAutoFocus(false);
    setScreen("candidate");
  };

  const clearForm = () => {
    setFormData({
      name: "",
      regNo: "",
      year: "",
      college: "",
      branch: "",
      whatsappNumber: "",
      preferences: {
        talentComm: {
          pref1: "",
          pref2: ""
        },
        workComm: {
          pref1: "",
          pref2: "",
          pref3: ""
        }
      },
      verdict: {
        talentComm: [],
        workComm: [],
      },
      comments: "",
      paid: false,
      paymentDetails: null,
      lastUpdatedBy: "",
      lastUpdatedAt: ""
    });
    localStorage.removeItem("formData");
    candidateDocKeyRef.current = null;
    setNotSelected(false);
    setSubmitErrors(null);

    // Exit manual entry mode when clearing form
    if (isManualEntry) {
      setIsManualEntry(false);
    }
  };

  // ---------- Candidate-screen field handlers (§6.3) ----------
  // Screens are presentational; every formData mutation lives here.

  const setCandidateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Year change keeps the existing 2nd-year clearing side effect (the old
  // year <select> handler, byte-identical logic).
  const setCandidateYear = (selectedYear) => {
    setFormData((prev) => ({
      ...prev,
      year: selectedYear,
      // Clear WorkComm preferences for 2nd year students
      preferences: {
        ...prev.preferences,
        workComm:
          selectedYear === "2nd Year" || selectedYear === "2nd year"
            ? { pref1: "", pref2: "", pref3: "" }
            : prev.preferences.workComm,
      },
      // Clear WorkComm verdict for 2nd year students
      verdict: {
        ...prev.verdict,
        workComm:
          selectedYear === "2nd Year" || selectedYear === "2nd year"
            ? []
            : prev.verdict.workComm,
      },
    }));
  };

  const setCandidatePreference = (comm, key, value) => {
    setFormData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [comm]: {
          ...prev.preferences[comm],
          [key]: value,
        },
      },
    }));
  };

  // Domain rows ARE the verdict (§2 #9): a domain tap goes through the
  // existing handleVerdictChange semantics; it also clears the local
  // "Not selected" flag (mutual exclusion, §2 #10 — the other direction,
  // clearing domains, is confirmed in-screen before onMarkNotSelected).
  const toggleVerdictDomain = (type, domain) => {
    setNotSelected(false);
    handleVerdictChange(type, domain);
  };

  const markNotSelected = () => {
    // Not-selected submits the existing empty arrays (§2 #30).
    setFormData((prev) => ({
      ...prev,
      verdict: { talentComm: [], workComm: [] },
    }));
    setNotSelected(true);
  };

  const unmarkNotSelected = () => setNotSelected(false);

  // ---------- Submit (§6.3 / §13 3d — the surgical zone, landmine #1) ----------

  // The old manual-entry required-field checks, conditions unchanged, now
  // producing a field→message map for inline errors instead of the alert.
  const buildManualEntryErrors = () => {
    const fields = {};

    if (!formData.name.trim()) {
      fields.name = "Name is required for walk-ins";
    }
    if (!formData.regNo.trim()) {
      fields.regNo = "Registration number is required for walk-ins";
    }
    if (!formData.year.trim()) {
      fields.year = "Academic year is required for walk-ins";
    }
    if (!formData.college.trim()) {
      fields.college = "College is required for walk-ins";
    }
    if (!formData.branch.trim()) {
      fields.branch = "Branch is required for walk-ins";
    }
    if (!formData.whatsappNumber.trim()) {
      fields.whatsappNumber = "WhatsApp number is required for walk-ins";
    }

    // Validate year format
    const yearLower = formData.year.toLowerCase();
    if (!yearLower.includes('1st year') && !yearLower.includes('2nd year')) {
      fields.year = fields.year || "Academic year must be '1st Year' or '2nd Year'";
    }

    // Validate preferences based on year
    if (yearLower.includes('1st year')) {
      if (!formData.preferences.talentComm.pref1.trim()) {
        fields.talentPref1 = "TalentComm Preference 1 is required for 1st year students";
      }
      if (!formData.preferences.workComm.pref1.trim()) {
        fields.workPref1 = "WorkComm Preference 1 is required for 1st year students";
      }
    } else if (yearLower.includes('2nd year')) {
      if (!formData.preferences.talentComm.pref1.trim()) {
        fields.talentPref1 = "TalentComm Preference 1 is required for 2nd year students";
      }
    }

    return Object.keys(fields).length > 0 ? fields : null;
  };

  // §2 #12 / sanctioned exception (f): undo re-issues the captured pre-write
  // snapshot through the same write path, guarded by the pure stale-check
  // (fresh read → canUndo → write; no transaction). Owner decision
  // 2026-07-20: fired from the persistent Done-screen button instead of the
  // 10 s toast; returns true only when the restore write landed, so the
  // Done tap handler knows whether to walk back to the Candidate screen.
  const undoVerdictSubmit = async (captured) => {
    try {
      const ref = doc(db, "candidates", captured.docKey);
      const freshSnap = await getDoc(ref);
      const freshData = freshSnap.exists() ? freshSnap.data() : null;
      const freshMeta = freshData
        ? {
            lastUpdatedAt: freshData.lastUpdatedAt,
            lastUpdatedBy: freshData.lastUpdatedBy,
          }
        : null;

      if (!canUndo(captured.writtenMeta, freshMeta)) {
        const who =
          (freshMeta && freshMeta.lastUpdatedBy) || "another interviewer";
        toast({
          tone: "error",
          message: `Changed by ${who} just now — not undone.`,
        });
        return false;
      }

      await setDoc(ref, captured.snapshot);
      toast({ tone: "success", message: "Verdict undone" });
      return true;
    } catch (err) {
      toast({ tone: "error", message: "Undo failed: " + err.message });
      return false;
    }
  };

  // "Undo verdict" tap — fired from the Done screen OR the Payment overflow
  // (owner decision 2026-07-20; both surfaces share this one handler). One
  // shot: the capability is consumed on tap, so a stale-abort leaves the
  // existing abort toast and no button. On success the interviewer walks BACK
  // to the Candidate screen with the form exactly as it was pre-submit: the
  // routed reset (clearForm) wiped the live draft and the doc-key ref when
  // Done/Payment was entered, so the capability carries the restore payload
  // captured at submit time (form + notSelected + isManualEntry + docKey).
  // The Payment overflow only shows it while the capability is still alive
  // (paymentUndoAlive) — i.e. before any QR/hold/payment write, so the
  // pre-payment snapshot it restores can never wipe a real payment.
  const undoVerdict = async () => {
    const captured = verdictUndo;
    if (!captured) return;
    setVerdictUndo(null);
    const undone = await undoVerdictSubmit(captured);
    if (!undone) return;
    candidateDocKeyRef.current = captured.docKey;
    setFormData(captured.form);
    setNotSelected(captured.notSelected);
    setIsManualEntry(captured.isManualEntry);
    setSubmitErrors(null);
    setDoneRecap(null);
    setScreen("candidate");
  };

  // "Edit verdict" tap — the ALWAYS-present corrective on both Done and the
  // Payment overflow (owner truth 2026-07-20: interviewers may re-open a
  // just-recorded verdict to change verdict/preferences/comments/details and
  // resubmit at any time; the resubmit PRESERVES payment — buildCandidatePayload
  // spreads the loaded paid/paymentDetails through untouched, guarded by the
  // candidatePayload payment-preservation test). Unlike Undo it does NOT revert
  // the write — it just re-opens the record to change it. It reuses the undo
  // capability's captured restore payload (the just-submitted form + flags +
  // doc key) when that is still alive for this candidate; otherwise it re-opens
  // the candidate fresh by regNo from the live snapshot (walk-ins that never
  // had a pre-write snapshot, or a capability already retired by payment
  // activity). Either way it lands on the Candidate screen and leaves the
  // done/payment context, so the old capability clears.
  const editVerdict = (regNo) => {
    if (
      verdictUndo &&
      (verdictUndo.regNo === regNo || verdictUndo.docKey === regNo)
    ) {
      candidateDocKeyRef.current = verdictUndo.docKey;
      setFormData(verdictUndo.form);
      setNotSelected(verdictUndo.notSelected);
      setIsManualEntry(verdictUndo.isManualEntry);
      setSubmitErrors(null);
      setDoneRecap(null);
      clearVerdictUndo(); // leaving the done/payment context to edit
      setScreen("candidate");
      return;
    }
    // No live capability: re-open the candidate fresh from the live snapshot.
    // openCandidate captures the doc key, strips the id, clears the capability
    // and routes to Candidate (a no-op if the doc is gone from the snapshot).
    const live = candidates.find((c) => c.id === regNo || c.regNo === regNo);
    if (live) openCandidate(live);
  };

  // The routed transition that replaces the old silent post-save wipe: the
  // draft is cleared on successful submit so §6.2 never offers a stale
  // resume for a finished interview.
  const resetAfterSubmit = () => {
    clearForm();
  };

  // §6.5: latch the Done recap (name, verdict domains, payment state) from
  // the form BEFORE resetAfterSubmit wipes it. Display-local only — the
  // Stamp and payment pill on Done render from this, never from the DB.
  const latchDoneRecap = (source) => {
    setDoneRecap({
      name: source.name,
      // regNo carried so the Done "Edit verdict" fallback can re-open the
      // candidate fresh from the live snapshot when no undo capability is
      // alive (walk-ins, or after payment activity retired it). Display-local
      // only — never part of any Firestore payload.
      regNo: source.regNo,
      verdict: {
        talentComm: Array.isArray(source.verdict?.talentComm)
          ? source.verdict.talentComm
          : [],
        workComm: Array.isArray(source.verdict?.workComm)
          ? source.verdict.workComm
          : [],
      },
      // Phase 7a: mirror the additive verdictStatus that was just written, so
      // the Done stamp prefers the explicit field over the array fallback
      // (identical result — the submit guard requires a decision — but keeps
      // Done consistent with the §5 Track-1 source of truth).
      verdictStatus: deriveVerdictStatusForWrite(source.verdict, notSelected),
      paid: !!source.paid,
      manuallyVerified: !!source.manuallyVerified,
    });
  };

  // The write itself. The doc key is the one CAPTURED AT LOAD in
  // candidateDocKeyRef (landmine #2) — never live formData.regNo (for
  // loaded candidates regNo is not editable, and walk-ins lock the
  // generated key, so the fallback only covers pre-3c drafts).
  const performSubmit = async () => {
    setWalkInConfirmOpen(false);

    // Validate candidate data before saving (existing logic, inline errors)
    const validationErrors = FirebaseSecurity.validator.validateCandidateData(formData);
    if (validationErrors.length > 0) {
      const fields = {};
      validationErrors.forEach((msg, i) => {
        fields[SECURITY_ERROR_FIELDS[msg] || `error_${i}`] = msg;
      });
      setSubmitErrors(fields);
      return;
    }
    setSubmitErrors(null);
    setIsSubmitting(true);

    try {
      const docKey = candidateDocKeyRef.current || formData.regNo;

      // Pre-write snapshot for Undo (§2 #12): the candidate doc as the live
      // snapshot last saw it, id stripped. New docs (walk-ins) have no
      // pre-write snapshot — setDoc cannot delete, so their save toast
      // carries no Undo.
      const prior = candidates.find((c) => c.id === docKey);
      let priorSnapshot = null;
      if (prior) {
        const { id: _docId, ...rest } = prior;
        priorSnapshot = rest;
      }

      const ref = doc(db, "candidates", docKey);
      const payload = buildCandidatePayload(formData, {
        docKey,
        nowIso: new Date().toISOString(),
        userEmail: user?.email,
        // Phase 7a (§2 #29/#30): the explicit "Not selected — no committees"
        // flag drives the additive verdictStatus when no domains are chosen.
        notSelected,
      });
      // Final payload logged securely
      await setDoc(ref, payload);

      // Log security event
      FirebaseSecurity.auditLogger.logEvent('candidate_data_saved', {
        candidateId: formData.regNo,
        interviewer: user?.email
      });

      const savedName = formData.name;
      pushRecent({
        id: docKey,
        name: formData.name,
        regNo: formData.regNo,
        year: formData.year,
      });

      // Owner decision 2026-07-20: the capture feeds the persistent
      // Done-screen "Undo verdict" button — the save toast is plain
      // (default ttl, no undo countdown). form/notSelected/isManualEntry
      // are the pre-submit state the undo restores to the Candidate
      // screen. A submit REPLACES any previous capability ("another
      // submit" clears it). New docs (walk-ins) still have no pre-write
      // snapshot — setDoc cannot delete, so they carry no undo.
      if (priorSnapshot) {
        setVerdictUndo({
          docKey,
          regNo: formData.regNo,
          snapshot: priorSnapshot,
          writtenMeta: {
            lastUpdatedAt: payload.lastUpdatedAt,
            lastUpdatedBy: payload.lastUpdatedBy,
          },
          name: savedName,
          form: formData,
          notSelected,
          isManualEntry,
        });
      } else {
        setVerdictUndo(null);
      }
      toast({ tone: "success", message: `Saved · ${savedName}` });

      // Route (§6.3): domains selected + unpaid → Payment (form kept — the
      // QR flow reads it); otherwise → Done via the routed transition.
      const hasDomains =
        (Array.isArray(payload.verdict?.talentComm)
          ? payload.verdict.talentComm.length
          : 0) +
          (Array.isArray(payload.verdict?.workComm)
            ? payload.verdict.workComm.length
            : 0) >
        0;

      if (hasDomains && !formData.paid) {
        enterPayment(formData.regNo);
      } else {
        latchDoneRecap(formData);
        resetAfterSubmit();
        setScreen("done");
      }
    } catch (err) {
      toast({ tone: "error", message: "Error saving data: " + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    // Additional validation for manual entry (walk-ins), then the
    // ConfirmSheet guard — same condition, same write as the old
    // native confirm (sanctioned exception e).
    if (isManualEntry) {
      const manualErrors = buildManualEntryErrors();
      if (manualErrors) {
        setSubmitErrors(manualErrors);
        return;
      }
      setSubmitErrors(null);
      setWalkInConfirmOpen(true);
      return;
    }
    performSubmit();
  };

  // ---------- Payment screen orchestration (§6.4 / §13 3e) ----------
  // All handlers live here; Payment.jsx is presentational.

  // The Payment screen's subject: normally the loaded form; when the
  // pending chip re-enters a live session after another candidate was
  // opened, the session's candidate resolved from the live snapshot
  // (fallback stub) — the in-progress form draft is never clobbered.
  const resolvePaymentSubject = () => {
    const subjectRegNo = paymentFor || formData.regNo;
    if (subjectRegNo === formData.regNo) {
      return {
        data: formData,
        docKey: candidateDocKeyRef.current || formData.regNo,
        isForm: true,
      };
    }
    const liveDoc = candidates.find(
      (c) => c.regNo === subjectRegNo || c.id === subjectRegNo
    );
    if (liveDoc) {
      const { id: _docId, ...rest } = liveDoc;
      return { data: rest, docKey: liveDoc.id || liveDoc.regNo, isForm: false };
    }
    return {
      data: {
        name: (paymentSession && paymentSession.name) || "",
        regNo: subjectRegNo,
        paid: false,
        paymentDetails: null,
      },
      docKey: (paymentSession && paymentSession.docKey) || subjectRegNo,
      isForm: false,
      stub: true,
    };
  };

  const enterPayment = (regNo) => {
    setPaymentFor(regNo);
    setErrorMessage("");
    if (!(paymentSession && paymentSession.regNo === regNo)) {
      // No live session for this candidate: clear any stale QR/status left
      // over from a previous candidate's flow.
      setPaymentStatus("pending");
      setShowQRCode(false);
      setQrCodeData("");
      setVerificationCode("");
    }
    setScreen("payment");
  };

  // The amber "₹ pending · {name}" chip (§2 #18): tap returns to the
  // Payment screen for the session's candidate.
  const openPendingPayment = () => {
    if (!paymentSession) return;
    // Chip-hop rule (owner decision 2026-07-20): re-entering the capability
    // candidate's OWN payment context keeps the undo alive (the
    // SELECTED→payment route — only payment WRITES kill it there); hopping
    // to ANOTHER candidate's payment leaves the Done context, so it clears.
    setVerdictUndo((prev) =>
      prev &&
      (prev.regNo === paymentSession.regNo ||
        prev.docKey === paymentSession.docKey)
        ? prev
        : null
    );
    enterPayment(paymentSession.regNo);
  };

  // Landmine #5 (§2 #17): "Show QR" is idempotent — a live session for
  // this candidate is REUSED (same verification code, no attempt burned);
  // generation happens only when no session exists. "Regenerate" (timeout/
  // error banners only) calls generateQRCode directly, which respects the
  // existing MAX_ATTEMPTS cap.
  const showPaymentQR = () => {
    const subjectRegNo = paymentFor || formData.regNo;
    if (paymentSession && paymentSession.regNo === subjectRegNo) {
      setQrCodeData(paymentSession.qrString);
      setVerificationCode(paymentSession.verificationCode);
      setShowQRCode(true);
      if (!pollStartedRef.current.has(paymentSession.paymentId)) {
        // Restored after a reload: restart the 30 s poll for this session.
        setPaymentStatus("pending");
        setErrorMessage("");
        startPaymentVerification(paymentSession.paymentId);
      }
      return;
    }
    generateQRCode();
  };

  // Route out of a finished payment flow. Subject === the loaded form →
  // the interview is done: routed transition (clearForm) → Done. Chip
  // re-entry for a different candidate → back to Search with the current
  // draft untouched.
  const leavePaymentFinished = (subjectRegNo) => {
    setPaymentFor(null);
    if (subjectRegNo === formData.regNo) {
      // Backing out to Done KEEPS the undo capability: if no payment
      // activity happened, no payment writes exist for the snapshot to
      // wipe — undo may still be offered (owner decision 2026-07-20).
      latchDoneRecap(formData);
      resetAfterSubmit();
      setScreen("done");
    } else {
      // Chip re-entry backout to Search: away from the done/payment
      // context — the capability clears.
      clearVerdictUndo();
      setScreen("search");
    }
  };

  // §6.5 → §6.2: "Next candidate" — Search, cleared, autofocused. This is
  // the ONE route that autofocuses Search (§2 #45).
  const goNextCandidate = () => {
    setDoneRecap(null);
    clearVerdictUndo(); // "Next candidate" — the interviewer moved on
    setSearchName("");
    setSearchAutoFocus(true);
    setScreen("search");
  };

  // Work-screen back-outs (§6 chrome back, Payment back, Candidate cancel/
  // clear): landing on Search leaves the done/payment context, so the undo
  // capability clears with it (owner decision 2026-07-20).
  const backToSearch = () => {
    clearVerdictUndo();
    setScreen("search");
  };

  // §2 #18 / landmine #6 / sanctioned exception (b): Cancel payment passes
  // the PAYMENT ID to cleanup — the old "Close QR" passed verificationCode
  // (the wrong-ID bug at old App.js:2057–2059).
  const cancelPayment = async () => {
    setIsCancellingPayment(true);
    try {
      const subjectRegNo = paymentFor || formData.regNo;
      if (paymentSession && paymentSession.regNo === subjectRegNo) {
        await cleanupPaymentSession(paymentSession.paymentId);
        clearPaymentSessionState();
      }
      setShowQRCode(false);
      setPaymentStatus("pending");
      setErrorMessage("");
      setQrCodeData("");
      setVerificationCode("");
      leavePaymentFinished(subjectRegNo);
    } finally {
      setIsCancellingPayment(false);
    }
  };

  // §2 #15: the hold-to-confirm mark-paid (after the 600 ms hold). The write
  // is the EXISTING path (paid: true + paymentDetails); Stage C records WHICH
  // rail collected the fee — Cash or the selected UPI account — via the pure
  // buildPaymentClaim (the retired hardcoded method 'Manual' is gone; every
  // confirm is a human, owner truth #2). The account is whatever the ACCOUNT
  // zone has selected (PAYMENT_ACCOUNTS[selectedUpiId]); the || fallback keeps
  // a degenerate out-of-range index from ever building a claim off undefined.
  const confirmManualPaid = () => {
    const account = PAYMENT_ACCOUNTS[selectedUpiId] || PAYMENT_ACCOUNTS[0];
    const paymentDetails = buildPaymentClaim(account, new Date().toISOString());
    const subject = resolvePaymentSubject();
    // Payment activity — manual mark-paid fired for this candidate: the
    // Done-screen undo capability (if it is his) dies here (owner decision
    // 2026-07-20).
    clearVerdictUndoFor(subject.data.regNo, subject.docKey);
    if (subject.isForm) {
      setFormData({ ...formData, paid: true, paymentDetails });
    }
    // A live QR session for this candidate is now moot — cancel it with
    // the correct paymentId so the poll stops and the chip clears.
    if (paymentSession && paymentSession.regNo === subject.data.regNo) {
      cleanupPaymentSession(paymentSession.paymentId);
      clearPaymentSessionState();
    }
    setShowQRCode(false);
    if (!subject.stub) {
      // Same re-issue as the auto-confirm path (never from a stub — a
      // partial object through setDoc would wipe the doc's other fields).
      persistPaymentToCandidate(
        { ...subject.data, paid: true, paymentDetails },
        subject.docKey
      );
    }
    setGreenRoom({
      name: subject.data.name,
      regNo: subject.data.regNo,
      // Hand-confirmed payments have no transaction id — omit the txn line
      // rather than print the noise word (Payment.jsx guards on `txn`).
      txn: null,
      manual: true,
    });
  };

  // Green room done (tap or the 2.5 s auto-advance in Payment.jsx).
  const finishGreenRoom = () => {
    if (!greenRoom) return;
    const subjectRegNo = greenRoom.regNo;
    setGreenRoom(null);
    leavePaymentFinished(subjectRegNo);
  };

  // ---------- Check-in desk writes (owner feature 2026-07-20) ----------
  // The SAME additive update path the admin check-in uses (merge setDoc on
  // the candidate doc): activated:true PLUS the new additive activatedAt
  // server timestamp — the ONLY record fields the desk can ever touch,
  // beyond the shared updated-meta. Doc key = the snapshot doc id (landmine
  // #2: never assume regNo IS the key). Desk.jsx is presentational; both
  // writes live here.
  const deskCheckIn = async (cand) => {
    const key = cand.id || cand.regNo;
    // Same-person double-taps are already impossible (the row swaps to the
    // checked state / the button spins); a DIFFERENT candidate mid-flight
    // is a rapid desk queue — never dropped.
    if (!key || cand.activated === true) return false;
    setDeskBusyKey(key);
    try {
      await setDoc(
        doc(db, "candidates", key),
        {
          activated: true,
          activatedAt: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || "Check-in desk",
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast({
        tone: "success",
        message: `Checked in · ${cand.name || cand.regNo}`,
      });
      return true;
    } catch (error) {
      console.error("Desk check-in failed:", error);
      toast({ tone: "error", message: "Check-in failed: " + error.message });
      return false;
    } finally {
      // Clear only our own spinner — a later tap may own the key by now.
      setDeskBusyKey((k) => (k === key ? null : k));
    }
  };

  // "Mark as not arrived?" (confirmed in-screen): the additive revert —
  // an EXPLICIT activated:false (renders the Registered pill everywhere,
  // §5 step 3 — correct semantics for someone who has not shown up) and
  // the additive activatedAt cleared back to absent so a later re-check-in
  // stamps a fresh arrival time.
  const deskMarkNotArrived = async (cand) => {
    const key = cand.id || cand.regNo;
    if (!key) return false;
    try {
      await setDoc(
        doc(db, "candidates", key),
        {
          activated: false,
          activatedAt: deleteField(),
          lastUpdatedBy: user?.displayName || user?.email || "Check-in desk",
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast({ message: `Marked not arrived · ${cand.name || cand.regNo}` });
      return true;
    } catch (error) {
      console.error("Desk un-check-in failed:", error);
      toast({
        tone: "error",
        message: "Could not update: " + error.message,
      });
      return false;
    }
  };

  // ---------- Render: the §6 screen state machine ----------

  // Boot splash (§6.1): while onAuthStateChanged resolves on cold load, "/"
  // shows the black stage with the six-dot loader — restored sessions go
  // splash → Search and never see the Login form.
  if (!authResolved) {
    return <Login booting />;
  }

  // Signed out → the §6.1 Login stage.
  if (!user) {
    return (
      <>
        <Login onLogin={login} loading={isLoggingIn} error={loginError} />
        <ToastHost position="bottom-center" />
      </>
    );
  }

  // ---------- Role gate (owner feature 2026-07-20) ----------
  // Signed in but the live config/checkinDesk snapshot hasn't resolved yet:
  // hold the boot splash. A desk account must never flash the interviewer
  // state machine — and this is the ONLY router between the two trees, so
  // no interviewer surface (Candidate/Payment/verdict) is ever reachable
  // for a desk user: the machine below simply never renders for them.
  // UI-level separation on the existing trust model (DESIGN.md §8 note).
  if (!deskRoleLoaded) {
    return <Login booting />;
  }

  const isDeskUser = deskEmails.includes((user.email || "").toLowerCase());

  if (isDeskUser) {
    return (
      <div className="iv-app">
        <InterviewerChrome
          user={user}
          isOnline={isOnline}
          onSignOut={logout}
          stage
        />
        <ScreenEnter id="desk">
          <Desk
            candidates={candidates}
            loaded={candidatesLoaded}
            onCheckIn={deskCheckIn}
            onMarkNotArrived={deskMarkNotArrived}
            busyKey={deskBusyKey}
          />
        </ScreenEnter>
        <ToastHost position="bottom-center" />
      </div>
    );
  }

  // Signed in: the §6 state machine's four working screens — Candidate
  // (§6.3), Payment (§6.4), Done (§6.5, recap latched pre-reset; without a
  // recap it falls through to Search), everything else Search (§6.2).
  const onWorkScreen = screen === "candidate" || screen === "payment";
  // Draft banner data (§2 #46): a persisted formData draft that identifies
  // a candidate → offer Resume/Discard on Search, never silently reopen.
  const draft =
    !onWorkScreen && formData.name && formData.regNo
      ? { name: formData.name, regNo: formData.regNo }
      : null;
  // Resolve "My recent" stubs against the live snapshot so pills stay live.
  const recentRows = recents.map(
    (r) => candidates.find((c) => c.id === r.id) || r
  );
  // The waiting room (owner feature 2026-07-20): candidates the desk (or
  // admin) explicitly checked in who have no verdict yet — §5 isWaiting, an
  // additive VIEW over the same live candidates listener the desk writes
  // into (landmine #11 untouched: docs without the field are simply not
  // "waiting"; nothing gates on it). Longest-waiting first: activatedAt
  // ascending, Timestamp/ISO/missing all tolerated, missing last.
  const waitingRows = candidates.filter(isWaiting).sort(compareByActivatedAt);
  // §6.4 derivations: the payment subject, whether the live session belongs
  // to it (QR/status render only for matching sessions), and the pending
  // chip (live session + not on the Payment screen).
  const paymentSubject = screen === "payment" ? resolvePaymentSubject() : null;
  const sessionMatchesSubject = !!(
    paymentSubject &&
    paymentSession &&
    paymentSession.regNo === paymentSubject.data.regNo
  );
  // The Payment overflow's "Undo verdict" is offered ONLY while the capability
  // is still alive FOR THIS payment subject — it self-retires the moment any
  // QR/hold/payment activity fires (App clears verdictUndo), exactly as on
  // Done, so the pre-payment snapshot can never wipe a real payment write.
  const paymentUndoAlive = !!(
    paymentSubject &&
    verdictUndo &&
    (verdictUndo.regNo === paymentSubject.data.regNo ||
      verdictUndo.docKey === paymentSubject.docKey)
  );
  const qrVisible = !!(showQRCode && sessionMatchesSubject && qrCodeData);
  const pendingChip =
    paymentSession && screen !== "payment"
      ? { name: paymentSession.name || paymentSession.regNo }
      : null;
  const paymentTriesLeft = Math.max(
    0,
    RATE_LIMIT.MAX_ATTEMPTS - rateLimitCount
  );

  return (
    <div className="iv-app">
      <InterviewerChrome
        user={user}
        isOnline={isOnline}
        onSignOut={logout}
        stage={
          screen === "search" || screen === "candidate" || screen === "payment"
        }
        onBack={onWorkScreen ? backToSearch : undefined}
        ticket={
          onWorkScreen
            ? screen === "payment" && paymentSubject
              ? {
                  name: paymentSubject.data.name,
                  regNo: paymentSubject.data.regNo,
                }
              : { name: formData.name, regNo: formData.regNo }
            : null
        }
        pendingPayment={
          pendingChip
            ? { name: pendingChip.name, onOpen: openPendingPayment }
            : null
        }
      />
      {screen === "candidate" ? (
        <ScreenEnter id="candidate">
          <Candidate
            formData={formData}
            isWalkIn={isManualEntry}
            notSelected={notSelected}
            errors={submitErrors}
            submitting={isSubmitting}
            onChangeField={setCandidateField}
            onChangeYear={setCandidateYear}
            onChangePreference={setCandidatePreference}
            onToggleDomain={toggleVerdictDomain}
            onMarkNotSelected={markNotSelected}
            onUnmarkNotSelected={unmarkNotSelected}
            onChangeComments={(value) => setCandidateField("comments", value)}
            onSubmit={handleSubmit}
            onClear={() => {
              clearForm();
              backToSearch();
            }}
            onCancel={backToSearch}
          />
        </ScreenEnter>
      ) : screen === "done" && doneRecap ? (
        <ScreenEnter id="done">
          <Done
            recap={doneRecap}
            onNext={goNextCandidate}
            canUndoVerdict={!!verdictUndo}
            onUndoVerdict={undoVerdict}
            onEditVerdict={() => editVerdict(doneRecap.regNo)}
          />
        </ScreenEnter>
      ) : screen !== "payment" ? (
        <ScreenEnter id="search">
          <Search
            query={searchName}
            onQueryChange={setSearchName}
            results={searchResults}
            loading={!candidatesLoaded}
            draft={draft}
            onResumeDraft={resumeDraft}
            onDiscardDraft={clearForm}
            recents={recentRows}
            waiting={waitingRows}
            onSelect={openCandidate}
            onSelectRecent={openRecent}
            onAddWalkIn={startWalkIn}
            onClearRecents={clearRecents}
            autoFocus={searchAutoFocus}
          />
        </ScreenEnter>
      ) : (
        <ScreenEnter id="payment">
          <Payment
            subject={paymentSubject.data}
            amount={paymentAmount}
            upiAccounts={PAYMENT_ACCOUNTS}
            selectedUpi={selectedUpiId}
            onSelectUpi={selectUpiAccount}
            qrVisible={qrVisible}
            qrElement={
              qrVisible ? (
                <QRCode value={qrCodeData} size={248} level="H" />
              ) : null
            }
            verificationCode={sessionMatchesSubject ? verificationCode : ""}
            sessionUpiId={sessionMatchesSubject ? paymentSession.upiId : null}
            status={paymentStatus}
            generating={isGeneratingQR}
            errorMessage={errorMessage}
            lastCheckAt={lastTransactionCheck}
            triesLeft={paymentTriesLeft}
            onShowQR={showPaymentQR}
            onRegenerate={generateQRCode}
            onMarkPaid={confirmManualPaid}
            canUndoVerdict={paymentUndoAlive}
            onUndoVerdict={undoVerdict}
            onEditVerdict={() => editVerdict(paymentSubject.data.regNo)}
            onBack={backToSearch}
            onCancelPayment={cancelPayment}
            cancelBusy={isCancellingPayment}
            greenRoom={greenRoom}
            onGreenRoomDone={finishGreenRoom}
            onContinue={() => leavePaymentFinished(paymentSubject.data.regNo)}
          />
        </ScreenEnter>
      )}
      {/* §6.6 / sanctioned exception (e): the walk-in native-confirm guard,
          now a ConfirmSheet — same condition (manual entry, post-validation),
          same write (performSubmit → the existing setDoc path). Mounted at
          App level so it works wherever handleSubmit fires. */}
      <ConfirmSheet
        open={walkInConfirmOpen}
        onClose={() => setWalkInConfirmOpen(false)}
        title="Create walk-in candidate?"
        message={`You are about to create a new candidate record for ${formData.name} (${formData.regNo}), ${formData.year}. This will be saved to the database.`}
        confirmLabel="Save walk-in"
        busy={isSubmitting}
        onConfirm={performSubmit}
      />
      <ToastHost position="bottom-center" />
    </div>
  );
}

export default App;
