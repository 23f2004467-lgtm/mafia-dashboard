import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { auth, provider, db } from "./firebaseConfig";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import QRCode from 'react-qr-code';
import { FirebaseSecurity } from './security';
import { buildCandidatePayload } from './candidatePayload';
import { ToastHost } from './ui';
import Login from './screens/interviewer/Login';
import Search from './screens/interviewer/Search';
import InterviewerChrome, { ScreenEnter } from './screens/interviewer/Chrome';
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
  // table in login() renders as a Banner on the Login screen — never alert().
  const [loginError, setLoginError] = useState("");
  // Connection dot state for the global chrome (§6).
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  // "My recent" (§6.2): last 5 candidates touched, persisted per device.
  const [recents, setRecents] = useState(readRecents);
  // §2 #45: Search autofocuses ONLY when arriving via "Next candidate" —
  // plumbed as a prop now; 3f's Done screen adds the setter when it wires
  // the next-candidate route (cold load never autofocuses).
  const [searchAutoFocus] = useState(false);
  // Landmine #2 prep: the Firestore doc key of the loaded candidate is
  // captured HERE at load time. 3d's submit path must use this ref, never
  // live formData.regNo.
  const candidateDocKeyRef = useRef(null);
  const [paymentAmount] = useState("300"); // Fixed at ₹300
  const [paymentStatus, setPaymentStatus] = useState("pending"); // pending, processing, completed, failed
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
  const [selectedUpiId, setSelectedUpiId] = useState(0); // Index of selected UPI ID
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(0); // Time left for payment

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
      
      // Start automatic verification
      startPaymentVerification(sessionData.paymentId);
      
      // Start countdown timer
      const totalTime = RATE_LIMIT.MAX_CHECK_ATTEMPTS * RATE_LIMIT.PAYMENT_CHECK_INTERVAL;
      setPaymentTimeLeft(totalTime);
      
      console.log('Starting countdown timer for:', totalTime, 'ms');
      
      const countdownInterval = setInterval(() => {
        setPaymentTimeLeft(prev => {
          if (prev <= 1000) {
            clearInterval(countdownInterval);
            console.log('Countdown timer finished');
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      
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
      setErrorMessage(error.message);
      alert(`Error: ${error.message}`);
    } finally {
      setIsGeneratingQR(false);
    }
  }, [isGeneratingQR, rateLimiter, user, formData, selectedUpiId, paymentAmount, performanceMonitor, connectionPool]);

  const startPaymentVerification = (paymentId) => {
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
          
          if (data.status === 'completed') {
            clearInterval(checkInterval);
            setPaymentStatus("completed");
            setFormData(prev => ({
              ...prev,
              paid: true,
              paymentDetails: {
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
              }
            }));
            setShowQRCode(false);
            setActivePaymentSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(paymentId);
              return newSet;
            });
            alert('Payment verified successfully!');
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
          setErrorMessage("Payment verification timeout. Please verify manually.");
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
          setErrorMessage("Payment verification failed due to network issues. You can still verify manually.");
          console.log('Payment verification error for:', paymentId, 'Error:', lastError);
          // Don't hide QR code on error - let user verify manually
          // setShowQRCode(false); // Removed this line
        }
      }
    }, RATE_LIMIT.PAYMENT_CHECK_INTERVAL);
    
    setLastTransactionCheck(new Date());
  };

  const verifyPaymentManually = async () => {
    if (!verificationCode) {
      alert('Please generate QR code first');
      return;
    }

    setPaymentStatus("processing");
    
    try {
      // Simulate manual verification
      const paymentResult = await simulateManualVerification(verificationCode);
      
      if (paymentResult.success) {
        setPaymentStatus("completed");
        setFormData(prev => ({
          ...prev,
          paid: true,
          paymentDetails: {
            transactionId: paymentResult.transactionId,
            amount: paymentAmount,
            timestamp: new Date().toISOString(),
            method: `${UPI_CONFIG.upiIds[selectedUpiId].type} QR (Manual)`,
            verificationCode: verificationCode,
            verified: true,
            upiId: UPI_CONFIG.upiIds[selectedUpiId].id,
            upiName: UPI_CONFIG.upiIds[selectedUpiId].name,
            upiType: UPI_CONFIG.upiIds[selectedUpiId].type
          }
        }));
        setShowQRCode(false);
        alert('Payment verified successfully!');
      } else {
        setPaymentStatus("failed");
        alert('Payment verification failed: ' + paymentResult.error);
      }
    } catch (error) {
      setPaymentStatus("failed");
      alert('Payment verification failed: ' + error.message);
    }
  };



  const simulateManualVerification = async (code) => {
    // This simulates checking your UPI app for the payment
    return new Promise((resolve) => {
      setTimeout(() => {
        // For now, we'll accept any valid verification code
        // In real usage, you would check your UPI app for the payment
        const isValidCode = code.length === 6 && code.match(/^[A-Z0-9]+$/);
        
        if (isValidCode) {
          // In production, you would:
          // 1. Check your UPI app (Google Pay, PhonePe, etc.)
          // 2. Look for payment of ₹300 from the candidate
          // 3. Verify the transaction note matches the verification code
          // 4. Only then return success
          
          resolve({
            success: true,
            transactionId: 'TXN_' + Date.now(),
            amount: paymentAmount,
            error: null
          });
        } else {
          resolve({
            success: false,
            transactionId: null,
            amount: paymentAmount,
            error: 'Invalid verification code format'
          });
        }
      }, 2000);
    });
  };

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

  // Add CSS for spinner animation
  useEffect(() => {
    const spinnerStyle = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = spinnerStyle;
    document.head.appendChild(styleSheet);

    return () => {
      if (styleSheet.parentNode) {
        styleSheet.parentNode.removeChild(styleSheet);
      }
    };
  }, []);

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

    // Check rate limiting — inline Banner, never alert() (§6.1)
    if (!FirebaseSecurity.rateLimiter.checkLimit('login', 5, 60000)) {
      setLoginError('Too many login attempts. Please try again later.');
      return;
    }

    // Check if user is locked out — inline Banner, never alert() (§6.1)
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

      // Inline Banner on the Login screen (§6.1) — never alert()
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
    setScreen("candidate");
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

  // Walk-in entry from Search (empty state / quiet link): same clear-form
  // behavior as the old "Start Manual Entry" button; the candidate screen
  // (old mega-page until 3d) renders in manual-entry mode.
  const startWalkIn = () => {
    candidateDocKeyRef.current = null; // key exists only after generation (§2 #23)
    setIsManualEntry(true);
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
    
    // Exit manual entry mode when clearing form
    if (isManualEntry) {
      setIsManualEntry(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Additional validation for manual entry
      if (isManualEntry) {
        const manualValidationErrors = [];
        
        // Check required fields for manual entry
        if (!formData.name.trim()) {
          manualValidationErrors.push("• Name is required for manual entry");
        }
        if (!formData.regNo.trim()) {
          manualValidationErrors.push("• Registration number is required for manual entry");
        }
        if (!formData.year.trim()) {
          manualValidationErrors.push("• Academic year is required for manual entry");
        }
        if (!formData.college.trim()) {
          manualValidationErrors.push("• College is required for manual entry");
        }
        if (!formData.branch.trim()) {
          manualValidationErrors.push("• Branch is required for manual entry");
        }
        if (!formData.whatsappNumber.trim()) {
          manualValidationErrors.push("• WhatsApp number is required for manual entry");
        }
        
        // Validate year format
        const yearLower = formData.year.toLowerCase();
        if (!yearLower.includes('1st year') && !yearLower.includes('2nd year')) {
          manualValidationErrors.push("• Academic year must be '1st Year' or '2nd Year'");
        }
        
        // Validate preferences based on year
        if (yearLower.includes('1st year')) {
          if (!formData.preferences.talentComm.pref1.trim()) {
            manualValidationErrors.push("• TalentComm Preference 1 is required for 1st year students");
          }
          if (!formData.preferences.workComm.pref1.trim()) {
            manualValidationErrors.push("• WorkComm Preference 1 is required for 1st year students");
          }
        } else if (yearLower.includes('2nd year')) {
          if (!formData.preferences.talentComm.pref1.trim()) {
            manualValidationErrors.push("• TalentComm Preference 1 is required for 2nd year students");
          }
        }
        
        if (manualValidationErrors.length > 0) {
          alert("❌ Manual Entry Validation Errors:\n" + manualValidationErrors.join("\n"));
          return;
        }
        
        // Confirm manual entry
        const confirmManual = window.confirm(
          "⚠️ Manual Entry Confirmation\n\n" +
          "You are about to create a new candidate record for:\n" +
          `• Name: ${formData.name}\n` +
          `• Reg No: ${formData.regNo}\n` +
          `• Year: ${formData.year}\n\n` +
          "This will be saved to the database. Continue?"
        );
        
        if (!confirmManual) {
          return;
        }
      }
      
      // Validate candidate data before saving
      const validationErrors = FirebaseSecurity.validator.validateCandidateData(formData);
      if (validationErrors.length > 0) {
        alert("❌ Validation errors:\n" + validationErrors.join("\n"));
        return;
      }

      const ref = doc(db, "candidates", formData.regNo);
      const payload = buildCandidatePayload(formData, {
        docKey: formData.regNo,
        nowIso: new Date().toISOString(),
        userEmail: user?.email,
      });
      // Final payload logged securely
      await setDoc(ref, payload);
      
      // Log security event
      FirebaseSecurity.auditLogger.logEvent('candidate_data_saved', {
        candidateId: formData.regNo,
        interviewer: user?.email
      });
      
      alert("✅ Data saved successfully!");
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
    } catch (err) {
      alert("Error saving data: " + err.message);
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

  // Signed in. Candidate/payment still render the OLD mega-page JSX until
  // 3d/3e replace those screens whole (landmine #12).
  const onMegaScreen = screen === "candidate" || screen === "payment";
  // Draft banner data (§2 #46): a persisted formData draft that identifies
  // a candidate → offer Resume/Discard on Search, never silently reopen.
  const draft =
    !onMegaScreen && formData.name && formData.regNo
      ? { name: formData.name, regNo: formData.regNo }
      : null;
  // Resolve "My recent" stubs against the live snapshot so pills stay live.
  const recentRows = recents.map(
    (r) => candidates.find((c) => c.id === r.id) || r
  );

  return (
    <div className="iv-app">
      <InterviewerChrome
        user={user}
        isOnline={isOnline}
        onSignOut={logout}
        onBack={onMegaScreen ? () => setScreen("search") : undefined}
        ticket={
          onMegaScreen
            ? { name: formData.name, regNo: formData.regNo }
            : null
        }
      />
      {!onMegaScreen ? (
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
            onSelect={openCandidate}
            onSelectRecent={openRecent}
            onAddWalkIn={startWalkIn}
            autoFocus={searchAutoFocus}
          />
        </ScreenEnter>
      ) : (
        <ScreenEnter id="candidate">
        {/* OLD mega-page candidate/payment JSX — replaced whole by 3d/3e */}
        <div style={{
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          minHeight: "100vh",
          padding: window.innerWidth <= 768 ? "1rem" : "2rem"
        }}>
        <div style={{
          maxWidth: window.innerWidth <= 768 ? "100%" : "800px",
          margin: "auto",
          padding: window.innerWidth <= 768 ? "0" : "0 1rem"
        }}>
          {/* Manual Entry Section */}
          <div className="mobile-card" style={{ 
            marginTop: "2rem", 
            padding: window.innerWidth <= 768 ? "1rem" : "1rem", 
            border: "1px solid #444", 
            borderRadius: "8px", 
            backgroundColor: "#1a1a1a" 
          }}>
            <h2 style={{
              ...styles.sectionTitle,
              fontSize: window.innerWidth <= 768 ? "1.3rem" : "1.5rem"
            }}>📝 Manual Entry (Walk-ins)</h2>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
              Use this option for walk-in candidates or when information isn't available in the system.
            </p>
            
            <div style={{ 
              display: "flex", 
              gap: "1rem", 
              marginBottom: "1rem",
              flexDirection: window.innerWidth <= 768 ? "column" : "row"
            }}>
              <button
                className="mobile-btn"
                style={{ 
                  ...styles.button, 
                  backgroundColor: isManualEntry ? "#cc0066" : "#444",
                  border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                  width: window.innerWidth <= 768 ? "100%" : "auto"
                }}
                onClick={() => {
                  setIsManualEntry(!isManualEntry);
                  if (!isManualEntry) {
                    // Clear form for manual entry
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
                      lastUpdatedBy: user?.displayName || user?.email || "Manual Entry",
                      lastUpdatedAt: new Date().toISOString()
                    });
                  }
                }}
              >
                {isManualEntry ? "❌ Cancel Manual Entry" : "📝 Start Manual Entry"}
              </button>
              
              {isManualEntry && (
                <button
                  className="mobile-btn mobile-btn-secondary"
                  style={{ 
                    ...styles.button, 
                    backgroundColor: "#0066cc",
                    width: window.innerWidth <= 768 ? "100%" : "auto"
                  }}
                  onClick={() => {
                    // Generate a temporary Reg No for manual entry
                    const tempRegNo = `WALKIN_${Date.now()}`;
                    setFormData(prev => ({
                      ...prev,
                      regNo: tempRegNo,
                      lastUpdatedBy: user?.displayName || user?.email || "Manual Entry",
                      lastUpdatedAt: new Date().toISOString()
                    }));
                  }}
                >
                  🆔 Generate Temp Reg No
                </button>
              )}
            </div>

            {isManualEntry && (
              <div style={{ 
                padding: "1rem", 
                backgroundColor: "var(--color-surface-elevated)", 
                borderRadius: "8px",
                border: "2px solid #cc0066"
              }}>
                <h3 style={{ color: "#ff0080", marginBottom: "1rem" }}>⚠️ Manual Entry Mode Active</h3>
                <p style={{ color: "#ffcc00", marginBottom: "1rem" }}>
                  <strong>Note:</strong> This will create a new candidate record. Make sure to collect all required information.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ color: "#ff0080", fontWeight: "bold" }}>Required Fields:</label>
                    <ul style={{ color: "var(--color-text-secondary)", margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                      <li>Name</li>
                      <li>Registration Number</li>
                      <li>Academic Year</li>
                      <li>College</li>
                      <li>Branch</li>
                      <li>WhatsApp Number</li>
                      <li>Preferences (based on year)</li>
                    </ul>
                  </div>
                  <div>
                    <label style={{ color: "#ff0080", fontWeight: "bold" }}>Year-Specific Requirements:</label>
                    <ul style={{ color: "var(--color-text-secondary)", margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                      <li><strong>1st Year:</strong> TalentComm + WorkComm preferences</li>
                      <li><strong>2nd Year:</strong> TalentComm preferences only</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              Name {isManualEntry && " *"}
            </label>
            <input
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px"
              }}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={isManualEntry ? "Enter candidate's full name" : ""}
            />
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              Reg No {isManualEntry && " *"}
            </label>
            <input
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px"
              }}
              type="text"
              value={formData.regNo}
              onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
              placeholder={isManualEntry ? "Enter registration number or use 'Generate Temp Reg No'" : ""}
            />
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              Academic Year {isManualEntry && " *"}
            </label>
            <select
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px",
                color: "#fff"
              }}
              value={formData.year}
              onChange={(e) => {
                const selectedYear = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  year: selectedYear,
                  // Clear WorkComm preferences for 2nd year students
                  preferences: {
                    ...prev.preferences,
                    workComm: selectedYear === "2nd Year" || selectedYear === "2nd year" 
                      ? { pref1: "", pref2: "", pref3: "" }
                      : prev.preferences.workComm
                  },
                  // Clear WorkComm verdict for 2nd year students
                  verdict: {
                    ...prev.verdict,
                    workComm: selectedYear === "2nd Year" || selectedYear === "2nd year" 
                      ? []
                      : prev.verdict.workComm
                  }
                }));
              }}
              disabled={!isManualEntry}
            >
              <option value="">Select Academic Year</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              College {isManualEntry && " *"}
            </label>
            <input
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px"
              }}
              type="text"
              value={formData.college}
              onChange={(e) => setFormData({ ...formData, college: e.target.value })}
              placeholder={isManualEntry ? "Enter college name" : ""}
            />
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              Branch {isManualEntry && " *"}
            </label>
            <input
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px"
              }}
              type="text"
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              placeholder={isManualEntry ? "Enter branch name" : ""}
            />
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label" style={{ color: isManualEntry ? "#ff0080" : "#ccc", fontWeight: isManualEntry ? "bold" : "normal" }}>
              WhatsApp Number {isManualEntry && " *"}
            </label>
            <input
              className="mobile-form-input"
              style={{
                ...styles.input,
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #666",
                backgroundColor: isManualEntry ? "#2a2a2a" : "#333",
                fontSize: "16px",
                minHeight: "44px"
              }}
              type="text"
              value={formData.whatsappNumber}
              onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              placeholder={isManualEntry ? "Enter 10-digit WhatsApp number" : ""}
            />
          </div>

          {/* Preferences Section - Conditional based on Year */}
          {formData.year && (
            <div className="mobile-card" style={{ 
              marginTop: "2rem", 
              padding: window.innerWidth <= 768 ? "1rem" : "1rem", 
              backgroundColor: "var(--color-surface-card)", 
              borderRadius: "8px", 
              border: isManualEntry ? "2px solid #ff0080" : "1px solid #333" 
            }}>
              <h3 style={{ 
                color: isManualEntry ? "#ff0080" : "#cc0066", 
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: window.innerWidth <= 768 ? "1.2rem" : "1.5rem"
              }}>
                Preferences {isManualEntry && " *"}
                {isManualEntry && <span style={{ fontSize: "0.8rem", color: "#ffcc00" }}>(Required based on year)</span>}
              </h3>
              
              {/* TalentComm Preferences - Show for both years */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">TalentComm Preference 1</label>
                <input
                  className="mobile-form-input"
                  style={{
                    ...styles.input,
                    fontSize: "16px",
                    minHeight: "44px"
                  }}
                  type="text"
                  value={formData.preferences.talentComm.pref1}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: {
                      ...formData.preferences,
                      talentComm: {
                        ...formData.preferences.talentComm,
                        pref1: e.target.value
                      }
                    }
                  })}
                />
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">TalentComm Preference 2</label>
                <input
                  className="mobile-form-input"
                  style={{
                    ...styles.input,
                    fontSize: "16px",
                    minHeight: "44px"
                  }}
                  type="text"
                  value={formData.preferences.talentComm.pref2}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: {
                      ...formData.preferences,
                      talentComm: {
                        ...formData.preferences.talentComm,
                        pref2: e.target.value
                      }
                    }
                  })}
                />
              </div>

              {/* WorkComm Preferences - Only show for 1st Year */}
              {(formData.year === "1st Year" || formData.year === "1st year") && (
                <>
                  <div className="mobile-form-group">
                    <label className="mobile-form-label">WorkComm Preference 1</label>
                    <input
                      className="mobile-form-input"
                      style={{
                        ...styles.input,
                        fontSize: "16px",
                        minHeight: "44px"
                      }}
                      type="text"
                      value={formData.preferences.workComm.pref1}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          workComm: {
                            ...formData.preferences.workComm,
                            pref1: e.target.value
                          }
                        }
                      })}
                    />
                  </div>

                  <div className="mobile-form-group">
                    <label className="mobile-form-label">WorkComm Preference 2</label>
                    <input
                      className="mobile-form-input"
                      style={{
                        ...styles.input,
                        fontSize: "16px",
                        minHeight: "44px"
                      }}
                      type="text"
                      value={formData.preferences.workComm.pref2}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          workComm: {
                            ...formData.preferences.workComm,
                            pref2: e.target.value
                          }
                        }
                      })}
                    />
                  </div>

                  <div className="mobile-form-group">
                    <label className="mobile-form-label">WorkComm Preference 3 (Optional)</label>
                    <input
                      className="mobile-form-input"
                      style={{
                        ...styles.input,
                        fontSize: "16px",
                        minHeight: "44px"
                      }}
                      type="text"
                      value={formData.preferences.workComm.pref3}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          workComm: {
                            ...formData.preferences.workComm,
                            pref3: e.target.value
                          }
                        }
                      })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mobile-form-group">
            <label className="mobile-form-label">TalentComm Domains</label>
            <div className="mobile-preferences-grid" style={{ 
              marginBottom: "1rem", 
              display: "flex", 
              flexWrap: "wrap", 
              gap: "0.5rem",
              gridTemplateColumns: window.innerWidth <= 768 ? "1fr 1fr" : "repeat(3, 1fr)"
            }}>
              {["Dance", "Music", "Art"].map((domain) => (
                <button
                  key={domain}
                  className="mobile-preference-btn"
                  onClick={() => handleVerdictChange("talentComm", domain)}
                  style={{
                    ...styles.button,
                    backgroundColor: Array.isArray(formData.verdict.talentComm) && formData.verdict.talentComm.includes(domain)
                      ? "green"
                      : "#800080",
                    minHeight: "44px",
                    fontSize: window.innerWidth <= 768 ? "0.9rem" : "1rem"
                  }}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* WorkComm Domains - Only show for 1st Year */}
          {(formData.year === "1st Year" || formData.year === "1st year") && (
            <div className="mobile-form-group">
              <label className="mobile-form-label">WorkComm Domains</label>
              <div className="mobile-preferences-grid" style={{ 
                marginBottom: "1rem", 
                display: "flex", 
                flexWrap: "wrap", 
                gap: "0.5rem",
                gridTemplateColumns: window.innerWidth <= 768 ? "1fr 1fr" : "repeat(2, 1fr)"
              }}>
                {["Human Resources", "Public Relations", "Social Media and Graphic Design", "Photography and Videography"].map((domain) => (
                  <button
                    key={domain}
                    className="mobile-preference-btn"
                    onClick={() => handleVerdictChange("workComm", domain)}
                    style={{
                      ...styles.button,
                      backgroundColor: Array.isArray(formData.verdict.workComm) && formData.verdict.workComm.includes(domain)
                        ? "green"
                        : "#800000",
                      minHeight: "44px",
                      fontSize: window.innerWidth <= 768 ? "0.8rem" : "1rem"
                    }}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Section */}
          <div className="mobile-payment-section" style={{ 
            marginTop: "2rem", 
            padding: window.innerWidth <= 768 ? "1rem" : "1rem", 
            backgroundColor: "var(--color-surface-card)", 
            borderRadius: "8px", 
            border: "1px solid #333" 
          }}>
            <h3 style={{ 
              color: "var(--color-primary)", 
              marginBottom: "1rem",
              fontSize: window.innerWidth <= 768 ? "1.2rem" : "1.5rem"
            }}>Payment</h3>
            
            {formData.paid ? (
              <div className="mobile-payment-status mobile-payment-paid">
                <span>✅</span>
                <span>Payment Completed</span>
                {formData.paymentDetails && (
                  <div style={{ fontSize: "0.9rem", marginTop: "0.5rem", width: "100%" }}>
                    <div>Transaction ID: {formData.paymentDetails.transactionId}</div>
                    <div>Verification Code: {formData.paymentDetails.verificationCode}</div>
                    <div>Amount: ₹{formData.paymentDetails.amount}</div>
                    <div>Method: {formData.paymentDetails.method}</div>
                    <div>Date: {new Date(formData.paymentDetails.timestamp).toLocaleString()}</div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label>Payment Amount (₹)</label>
                <div style={{
                  ...styles.input,
                  backgroundColor: "var(--color-surface-card)",
                  color: "#00ff88",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "default"
                }}>
                  ₹300 (Fixed Amount)
                </div>

                {/* QR Code Payment Section */}
                {!showQRCode ? (
                  <div style={{ backgroundColor: "var(--color-surface-elevated)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                    <h4 style={{ color: "#00ff88", marginBottom: "0.5rem" }}>📱 UPI Payment QR Code</h4>
                    
                    {/* UPI ID Selection */}
                    <div style={{ marginBottom: "1rem" }}>
                      <label style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.5rem", display: "block" }}>
                        Select UPI ID:
                      </label>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {UPI_CONFIG.upiIds.map((upi, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedUpiId(index)}
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: selectedUpiId === index ? "#00ff88" : "#444",
                              color: selectedUpiId === index ? "#000" : "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: "bold"
                            }}
                          >
                            {upi.name} ({upi.type})
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
                      <strong>Selected UPI ID:</strong> {UPI_CONFIG.upiIds[selectedUpiId].id}<br />
                      <strong>Amount:</strong> ₹{paymentAmount}<br />
                      <strong>Name:</strong> {UPI_CONFIG.merchantName}
                    </div>
                    
                    {errorMessage && (
                      <div style={{ color: "#ff6b6b", marginBottom: "1rem", padding: "0.5rem", backgroundColor: "#3a1a1a", borderRadius: "4px" }}>
                        ⚠️ {errorMessage}
                      </div>
                    )}
                    
                    <button
                      onClick={generateQRCode}
                      disabled={isGeneratingQR}
                      style={{ 
                        ...styles.button, 
                        backgroundColor: isGeneratingQR ? "#666" : "#00ff88", 
                        color: isGeneratingQR ? "#ccc" : "#000",
                        cursor: isGeneratingQR ? "not-allowed" : "pointer"
                      }}
                    >
                      {isGeneratingQR ? (
                        <>
                          <span>Generating...</span>
                          <div style={{ width: "16px", height: "16px", border: "2px solid #000", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                        </>
                      ) : (
                        "🎯 Generate QR Code"
                      )}
                    </button>
                    
                    {rateLimitCount > 0 && (
                      <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.5rem" }}>
                        QR generations: {rateLimitCount}/{RATE_LIMIT.MAX_ATTEMPTS}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ backgroundColor: "var(--color-surface-elevated)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", textAlign: "center" }}>
                    <h4 style={{ color: "#00ff88", marginBottom: "1rem" }}>📱 Scan QR Code</h4>
                    <div style={{ fontSize: "0.8rem", color: "#00ff88", marginBottom: "0.5rem" }}>
                      Using: {UPI_CONFIG.upiIds[selectedUpiId].name} ({UPI_CONFIG.upiIds[selectedUpiId].type})
                    </div>
                    
                    {/* QR Code Display */}
                    <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", display: "inline-block", marginBottom: "1rem" }}>
                      <QRCode 
                        value={qrCodeData}
                        size={200}
                        level="H"
                      />
                    </div>
                    
                    <div style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
                      <strong>Verification Code:</strong> {verificationCode}<br />
                      <strong>Amount:</strong> ₹{paymentAmount}<br />
                      <strong>Status:</strong> {
                        paymentStatus === "pending" ? "⏳ Waiting for payment..." : 
                        paymentStatus === "processing" ? "🔄 Verifying..." :
                        paymentStatus === "completed" ? "✅ Payment verified!" :
                        paymentStatus === "timeout" ? "⏰ Timeout - verify manually" :
                        paymentStatus === "cancelled" ? "❌ Cancelled" :
                        paymentStatus === "error" ? "💥 Error occurred" : "❌ Failed"
                      }
                      {paymentTimeLeft > 0 && (
                        <div style={{ marginTop: "0.5rem", color: paymentTimeLeft < 60000 ? "#ffaa00" : "#00ff88" }}>
                          <strong>Time Left:</strong> {Math.floor(paymentTimeLeft / 60000)}:{(paymentTimeLeft % 60000 / 1000).toFixed(0).padStart(2, '0')}
                        </div>
                      )}
                    </div>
                    
                    {errorMessage && (
                      <div style={{ color: "#ff6b6b", marginBottom: "1rem", padding: "0.5rem", backgroundColor: "#3a1a1a", borderRadius: "4px" }}>
                        ⚠️ {errorMessage}
                      </div>
                    )}
                    
                    {lastTransactionCheck && (
                      <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>
                        Last checked: {lastTransactionCheck.toLocaleTimeString()}
                      </div>
                    )}
                    
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={verifyPaymentManually}
                        disabled={paymentStatus === "processing"}
                        style={{
                          ...styles.button,
                          backgroundColor: paymentStatus === "processing" ? "#666" : "#4285f4",
                          color: paymentStatus === "processing" ? "#ccc" : "white"
                        }}
                      >
                        {paymentStatus === "processing" ? "Verifying..." : "Verify Manually"}
                      </button>
                      
                      <div style={{ fontSize: "0.9rem", color: "#00ff88", marginTop: "0.5rem", textAlign: "center", padding: "0.5rem", backgroundColor: "#1a2a1a", borderRadius: "4px" }}>
                        💡 <strong>Manual Verification:</strong><br />
                        • Check your UPI app for ₹300 payment<br />
                        • Look for verification code: <strong>{verificationCode}</strong><br />
                        • Click "Verify Manually" once payment is confirmed
                      </div>
                      
                      <button
                        onClick={async () => {
                          if (verificationCode) {
                            await cleanupPaymentSession(verificationCode);
                          }
                          setShowQRCode(false);
                          setPaymentStatus("pending");
                          setErrorMessage("");
                        }}
                        style={{ ...styles.button, backgroundColor: "#666" }}
                      >
                        Close QR
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowQRCode(false);
                          setPaymentStatus("pending");
                          setErrorMessage("");
                          // Don't cleanup session - let it continue checking
                        }}
                        style={{ ...styles.button, backgroundColor: "#ffaa00", color: "#000" }}
                      >
                        Hide QR (Keep Checking)
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Payment Option */}
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#333", borderRadius: "8px" }}>
                  <h4 style={{ color: "#ffaa00", marginBottom: "0.5rem" }}>⚠️ Manual Payment</h4>
                  <button
                    onClick={() => setFormData({ ...formData, paid: true, paymentDetails: { method: 'Manual', timestamp: new Date().toISOString() } })}
                    style={{ ...styles.button, backgroundColor: "#ffaa00", color: "#000" }}
                  >
                    Mark as Paid (Manual)
                  </button>
                </div>
                
                {/* Show QR Code Again Option */}
                {!showQRCode && verificationCode && (paymentStatus === "pending" || paymentStatus === "timeout") && (
                  <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "var(--color-surface-elevated)", borderRadius: "8px" }}>
                    <h4 style={{ color: "#00ff88", marginBottom: "0.5rem" }}>📱 Payment Still Active</h4>
                    <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                      Payment verification is still active. You can show the QR code again if needed.
                    </p>
                    <button
                      onClick={() => setShowQRCode(true)}
                      style={{ ...styles.button, backgroundColor: "#00ff88", color: "#000" }}
                    >
                      Show QR Code Again
                    </button>
                  </div>
                )}


                
                {paymentStatus === "failed" && (
                  <div style={{ color: "#ff6b6b", marginTop: "0.5rem" }}>
                    Payment verification failed. Please try again or verify manually.
                  </div>
                )}
                
                {paymentStatus === "timeout" && (
                  <div style={{ color: "#ffaa00", marginTop: "0.5rem" }}>
                    Automatic verification timeout. Please check your Google Pay app and verify manually.
                  </div>
                )}
              </div>
            )}
          </div>

          <label>Comments</label>
          <textarea
            style={styles.input}
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            placeholder="Enter notes about their talent..."
          ></textarea>

          <div style={{
            display: "flex",
            gap: "1rem",
            marginTop: "1rem",
            flexDirection: window.innerWidth <= 768 ? "column" : "row"
          }}>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={handleSubmit}
              style={{ 
                ...styles.button, 
                backgroundColor: isManualEntry ? "#ff0080" : "#cc0066",
                border: isManualEntry ? "2px solid #ff0080" : "1px solid #cc0066",
                width: window.innerWidth <= 768 ? "100%" : "auto",
                flex: window.innerWidth <= 768 ? "none" : "1"
              }}
            >
              {isManualEntry ? "📝 Create New Candidate" : "Submit"}
            </button>
            
            <button
              className="mobile-btn mobile-btn-danger"
              onClick={clearForm}
              style={{ 
                ...styles.button, 
                backgroundColor: isManualEntry ? "#ff4444" : "#666", 
                width: window.innerWidth <= 768 ? "100%" : "auto",
                flex: window.innerWidth <= 768 ? "none" : "1"
              }}
            >
              {isManualEntry ? "❌ Cancel Manual Entry" : "Clear Form"}
            </button>
          </div>
        </div>
        </div>
        </ScreenEnter>
      )}
      <ToastHost position="bottom-center" />
    </div>
  );
}

const styles = {
  input: {
    width: "100%",
    padding: "0.5rem",
    margin: "0.5rem 0 1rem 0",
    borderRadius: "8px",
    border: "1px solid #333",
    backgroundColor: "var(--color-surface-card)",
    color: "white",
  },
  button: {
    padding: "0.6rem 1rem",
    borderRadius: "8px",
    border: "none",
    color: "white",
    cursor: "pointer",
  },
  // Login page styles
  loginContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "2rem",
    background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
  },
  loginCard: {
    backgroundColor: "rgba(26, 26, 26, 0.95)",
    borderRadius: "20px",
    padding: "3.5rem",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    maxWidth: "450px",
    width: "100%",
    textAlign: "center",
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden",
  },
  loginHeader: {
    marginBottom: "2.5rem",
    position: "relative",
  },
  logoContainer: {
    position: "relative",
    display: "inline-block",
    marginBottom: "1rem",
  },
  brandLogo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  logoImage: {
    width: "80px",
    height: "80px",
    objectFit: "contain",
    filter: "drop-shadow(0 0 10px rgba(204, 0, 102, 0.5))",
    marginBottom: "0.5rem",
  },
  logoSubtitle: {
    fontSize: "1rem",
    color: "var(--color-primary)",
    fontWeight: "500",
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginTop: "-0.5rem",
  },
  logoGlow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "150px",
    height: "150px",
    background: "radial-gradient(circle, rgba(204, 0, 102, 0.3) 0%, transparent 70%)",
    borderRadius: "50%",
    filter: "blur(20px)",
    animation: "pulse 2s ease-in-out infinite alternate",
  },
  loginTitle: {
    fontSize: "3.5rem",
    color: "var(--color-primary)",
    margin: "0 0 0.5rem 0",
    fontWeight: "bold",
    textShadow: "0 0 20px rgba(204, 0, 102, 0.5)",
    position: "relative",
    zIndex: 1,
    letterSpacing: "3px",
  },
  loginSubtitle: {
    fontSize: "1.3rem",
    color: "var(--color-text-tertiary)",
    margin: 0,
    fontWeight: "300",
    letterSpacing: "1px",
  },
  loginContent: {
    marginBottom: "2rem",
  },
  loginDescription: {
    color: "var(--color-text-secondary)",
    marginBottom: "2.5rem",
    lineHeight: "1.7",
    fontSize: "1rem",
    fontWeight: "300",
  },
  loginButton: {
    backgroundColor: "#4285f4",
    color: "white",
    padding: "1.2rem 2rem",
    borderRadius: "12px",
    border: "none",
    fontSize: "1.1rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.8rem",
    width: "100%",
    marginBottom: "2.5rem",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 25px rgba(66, 133, 244, 0.4)",
    fontWeight: "500",
    letterSpacing: "0.5px",
  },
  googleIcon: {
    fontSize: "1.3rem",
  },
  loginFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
    marginBottom: "2rem",
  },
  feature: {
    display: "flex",
    alignItems: "center",
    gap: "0.8rem",
    color: "#aaa",
    fontSize: "0.95rem",
    padding: "0.5rem",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },
  featureIcon: {
    fontSize: "1.2rem",
    opacity: "0.8",
  },
  contactInfo: {
    marginTop: "2rem",
    padding: "1.5rem",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  contactHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.8rem",
  },
  contactIcon: {
    fontSize: "1.2rem",
    color: "var(--color-primary)",
  },
  contactTitle: {
    color: "var(--color-primary)",
    fontWeight: "bold",
    fontSize: "1rem",
  },
  contactText: {
    color: "var(--color-text-tertiary)",
    fontSize: "0.9rem",
    margin: 0,
    lineHeight: "1.5",
  },
  contactNumber: {
    color: "var(--color-primary)",
    fontWeight: "bold",
    fontSize: "1.1rem",
    textShadow: "0 0 10px rgba(204, 0, 102, 0.3)",
  },
  // Dashboard styles
  dashboardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "2.5rem",
    paddingBottom: "1.5rem",
    borderBottom: "2px solid rgba(255, 255, 255, 0.1)",
    background: "rgba(255, 255, 255, 0.02)",
    padding: "2rem",
    borderRadius: "16px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  dashboardBrand: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  dashboardLogo: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  dashboardLogoImage: {
    width: "60px",
    height: "60px",
    objectFit: "contain",
    filter: "drop-shadow(0 0 15px rgba(204, 0, 102, 0.5))",
  },
  dashboardTitle: {
    color: "var(--color-primary)",
    margin: 0,
    fontSize: "2.5rem",
    fontWeight: "bold",
    textShadow: "0 0 20px rgba(204, 0, 102, 0.3)",
    letterSpacing: "2px",
  },
  dashboardSubtitle: {
    color: "var(--color-text-tertiary)",
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "300",
    letterSpacing: "1px",
  },
  welcomeText: {
    color: "var(--color-text-tertiary)",
    margin: "0.5rem 0 0 0",
    fontSize: "1.1rem",
    fontWeight: "300",
  },
  userName: {
    color: "var(--color-primary)",
    fontWeight: "bold",
  },
  headerActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "1rem",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  userIcon: {
    fontSize: "1rem",
    color: "var(--color-primary)",
  },
  userEmail: {
    color: "var(--color-text-secondary)",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  searchSection: {
    marginBottom: "2rem",
    padding: "1.5rem",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  sectionTitle: {
    color: "var(--color-primary)",
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    textShadow: "0 0 10px rgba(204, 0, 102, 0.3)",
  },
  footer: {
    marginTop: "3rem",
    padding: "1.5rem",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
  },
  footerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
  },
  footerBrand: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  footerLogoImage: {
    width: "30px",
    height: "30px",
    objectFit: "contain",
    filter: "drop-shadow(0 0 10px rgba(204, 0, 102, 0.5))",
  },
  footerTitle: {
    color: "var(--color-primary)",
    fontSize: "1.2rem",
    fontWeight: "bold",
    letterSpacing: "1px",
  },
  footerInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.25rem",
  },
  footerText: {
    color: "var(--color-text-tertiary)",
    fontSize: "0.9rem",
  },
  footerContact: {
    color: "var(--color-primary)",
    fontSize: "0.9rem",
    fontWeight: "bold",
  },
  logoutButton: {
    backgroundColor: "#ff4444",
    color: "white",
    padding: "0.8rem 1.5rem",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(255, 68, 68, 0.3)",
    letterSpacing: "0.5px",
  },
};

export default App;
