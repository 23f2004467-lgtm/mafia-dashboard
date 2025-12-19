import React, { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
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
import { debounce, throttle, DataCache, PerformanceMonitor } from './performanceOptimizations';

function AdminPortal() {
  // Performance optimizations
  const performanceMonitor = useMemo(() => new PerformanceMonitor(), []);
  const dataCache = useMemo(() => new DataCache(100), []);

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

  // Payment analytics
  const total = candidates.length;
  const paid = candidates.filter((c) => c.paid).length;
  const unpaid = total - paid;
  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  const manuallyVerified = candidates.filter((c) => c.manuallyVerified).length;
  

  const totalAmount = candidates.reduce((sum, c) => {
    if (c.paid) {
      // For manual payments or payments without amount, count as ₹300
      const amount = c.paymentDetails?.amount ? Number(c.paymentDetails.amount) : 300;
      return sum + amount;
    }
    return sum;
  }, 0);

  const handleLogin = async () => {
    if (isLoggingIn) return;

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    // Check rate limiting for admin login
    if (!FirebaseSecurity.rateLimiter.checkLimit('admin_login', 3, 300000)) { // 5 minutes
      alert('Too many admin login attempts. Please try again later.');
      return;
    }

    // Check if admin is locked out
    if (FirebaseSecurity.sessionManager.isLockedOut('admin_login')) {
      alert('Admin access temporarily locked due to too many failed attempts.');
      return;
    }

    setIsLoggingIn(true);
    try {
      await SecureAdminAuth.adminLogin(email, password);
      
      // Record successful admin login
      FirebaseSecurity.sessionManager.recordLoginAttempt('admin_login', true);
      FirebaseSecurity.auditLogger.logEvent('admin_login_success', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        email: email
      });
      
      setAuthenticated(true);
    } catch (error) {
      console.error('Admin login failed:', error);
      
      // Record failed admin login attempt
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
      setAuthenticated(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error('Admin logout failed:', error);
      // Still log out locally
      setAuthenticated(false);
      setEmail("");
      setPassword("");
    }
  };

  // Clear all interviewer data (payments, verdicts, comments)
  const clearAllInterviewerData = async () => {
    if (!window.confirm('⚠️ WARNING: This will clear ALL interviewer input data including:\n\n• Payment confirmations\n• Interview verdicts (Selected/Rejected/Waitlisted)\n• Comments\n• Last updated information\n\nThis action cannot be undone. Are you sure you want to proceed?')) {
      return;
    }

    if (!window.confirm('🔄 FINAL CONFIRMATION:\n\nThis will reset all candidates to their original state with:\n• No payment confirmations\n• No interview verdicts\n• No comments\n• No interviewer updates\n\nType "CONFIRM" to proceed:')) {
      return;
    }

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
          verdict: {
            talentComm: [],
            workComm: []
          },
          comments: '',
          lastUpdatedBy: 'Admin - Data Reset',
          lastUpdatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await Promise.all(updatePromises);
      
      // Log the action
      FirebaseSecurity.auditLogger.logEvent('admin_clear_all_data', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        adminEmail: email,
        candidatesCleared: snapshot.docs.length
      });

      alert(`✅ Successfully cleared all interviewer data for ${snapshot.docs.length} candidates!`);
    } catch (error) {
      console.error('Error clearing interviewer data:', error);
      alert('❌ Failed to clear interviewer data: ' + error.message);
    } finally {
      setIsClearDataLoading(false);
    }
  };

  const forceLogoutAllInterviewers = async () => {
    if (!window.confirm("Are you sure you want to force logout all interviewers? This will immediately log them out of the system.")) {
      return;
    }

    setIsForceLogoutLoading(true);
    try {
      // Delete all interviewer sessions using Firebase v9 syntax
      const interviewersRef = collection(db, "interviewers");
      const snapshot = await getDocs(interviewersRef);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      alert("✅ All interviewers have been force logged out successfully!");
    } catch (error) {
      console.error("Error force logging out interviewers:", error);
      alert("❌ Error force logging out interviewers: " + error.message);
    } finally {
      setIsForceLogoutLoading(false);
    }
  };

  const clearAllCandidateData = async () => {
    if (!window.confirm("⚠️ WARNING: This will permanently delete ALL candidate data from the database. This action cannot be undone. Are you absolutely sure?")) {
      return;
    }

    const secondConfirm = window.confirm("🔴 FINAL CONFIRMATION: You are about to delete ALL candidate data. Type 'DELETE ALL' to confirm.");
    if (!secondConfirm) {
      return;
    }

    try {
      // Get all candidates
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);
      
      if (snapshot.empty) {
        alert("ℹ️ No candidate data found to delete.");
        return;
      }

      // Delete all candidate documents
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Also clear payment sessions
      const paymentSessionsRef = collection(db, "paymentSessions");
      const paymentSnapshot = await getDocs(paymentSessionsRef);
      const paymentDeletePromises = paymentSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentDeletePromises);
      
      alert(`✅ Successfully deleted ${snapshot.docs.length} candidate records and ${paymentSnapshot.docs.length} payment sessions!`);
      
      // Log the action
      FirebaseSecurity.auditLogger.logEvent('admin_cleared_all_data', {
        timestamp: new Date().toISOString(),
        adminEmail: email,
        candidatesDeleted: snapshot.docs.length,
        paymentSessionsDeleted: paymentSnapshot.docs.length
      });
      
    } catch (error) {
      console.error("Error clearing candidate data:", error);
      alert("❌ Error clearing candidate data: " + error.message);
    }
  };




  const reversePaymentForCandidate = async (candidate) => {
    if (!candidate.paid) {
      alert("This candidate has not made any payment to reverse.");
      return;
    }

    const confirmReverse = window.confirm(
      `Are you sure you want to reverse the payment confirmation for ${candidate.name} (${candidate.regNo})?\n\nThis will mark them as unpaid and remove payment details.`
    );

    if (!confirmReverse) {
      return;
    }

    try {
      // Update the candidate document in Firebase
      const candidateRef = doc(db, 'candidates', candidate.regNo);
      await setDoc(candidateRef, {
        paid: false,
        paymentDetails: null,
        manuallyVerified: false,
        lastUpdatedBy: 'Admin',
        lastUpdatedAt: new Date().toISOString(),
        paymentReversed: {
          reversedBy: 'Admin',
          reversedAt: new Date().toISOString(),
          previousPaymentDetails: candidate.paymentDetails
        }
      }, { merge: true });

      // Update local state immediately
      setCandidates(prevCandidates => 
        prevCandidates.map(c => 
          c.regNo === candidate.regNo 
            ? {
                ...c,
                paid: false,
                paymentDetails: null,
                manuallyVerified: false,
                lastUpdatedBy: 'Admin',
                lastUpdatedAt: new Date().toISOString(),
                paymentReversed: {
                  reversedBy: 'Admin',
                  reversedAt: new Date().toISOString(),
                  previousPaymentDetails: candidate.paymentDetails
                }
              }
            : c
        )
      );

      alert(`✅ Payment confirmation has been reversed for ${candidate.name}!`);
    } catch (error) {
      console.error('Error reversing payment:', error);
      alert('❌ Failed to reverse payment: ' + error.message);
    }
  };

  const manuallyVerifyPayment = async (candidate) => {
    if (!candidate.paid) {
      alert("This candidate has not made any payment to verify.");
      return;
    }

    if (candidate.manuallyVerified) {
      alert("This payment has already been manually verified.");
      return;
    }

    try {
      // Update the candidate document in Firebase
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

      // Update local state immediately
      setCandidates(prevCandidates => 
        prevCandidates.map(c => 
          c.regNo === candidate.regNo 
            ? {
                ...c,
                manuallyVerified: true,
                manualVerificationDetails: {
                  verifiedBy: 'Admin',
                  verifiedAt: new Date().toISOString(),
                  paymentAmount: c.paymentDetails?.amount || 300,
                  paymentMethod: c.paymentDetails?.method || 'Manual Verification'
                },
                lastUpdatedBy: 'Admin',
                lastUpdatedAt: new Date().toISOString()
              }
            : c
        )
      );

      console.log(`✅ Payment manually verified for ${candidate.name}!`);
    } catch (error) {
      console.error('Error manually verifying payment:', error);
      alert('❌ Failed to manually verify payment: ' + error.message);
    }
  };

  const unverifyPayment = async (candidate) => {
    if (!candidate.manuallyVerified) {
      alert("This payment has not been manually verified.");
      return;
    }

    const confirmUnverify = window.confirm(
      `Are you sure you want to unverify the payment for ${candidate.name} (${candidate.regNo})?\n\nThis will remove the manual verification status but keep the payment as paid.`
    );

    if (!confirmUnverify) {
      return;
    }

    try {
      // Update the candidate document in Firebase
      const candidateRef = doc(db, 'candidates', candidate.regNo);
      await setDoc(candidateRef, {
        manuallyVerified: false,
        manualVerificationDetails: null,
        lastUpdatedBy: 'Admin',
        lastUpdatedAt: new Date().toISOString()
      }, { merge: true });

      // Update local state immediately
      setCandidates(prevCandidates => 
        prevCandidates.map(c => 
          c.regNo === candidate.regNo 
            ? {
                ...c,
                manuallyVerified: false,
                manualVerificationDetails: null,
                lastUpdatedBy: 'Admin',
                lastUpdatedAt: new Date().toISOString()
              }
            : c
        )
      );

      console.log(`✅ Manual verification removed for ${candidate.name}!`);
    } catch (error) {
      console.error('Error removing manual verification:', error);
      alert('❌ Failed to remove manual verification: ' + error.message);
    }
  };

  const exportToExcel = async () => {
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
      PaymentCode: cand.paymentDetails?.verificationCode || "",
      TalentCommPrefs: `${cand.preferences?.talentComm?.pref1 || ""}${cand.preferences?.talentComm?.pref2 ? `, ${cand.preferences.talentComm.pref2}` : ""}`,
      WorkCommPrefs: `${cand.preferences?.workComm?.pref1 || ""}${cand.preferences?.workComm?.pref2 ? `, ${cand.preferences.workComm.pref2}` : ""}${cand.preferences?.workComm?.pref3 ? `, ${cand.preferences.workComm.pref3}` : ""}`,
      TalentCommVerdict: Array.isArray(cand.verdict?.talentComm)
        ? cand.verdict.talentComm.join(", ")
        : "",
      WorkCommVerdict: Array.isArray(cand.verdict?.workComm)
        ? cand.verdict.workComm.join(", ")
        : "",
      Comments: cand.comments || "",
      LastUpdatedBy: cand.lastUpdatedBy || "",
      LastUpdatedAt: cand.lastUpdatedAt
        ? new Date(
            cand.lastUpdatedAt.seconds
              ? cand.lastUpdatedAt.seconds * 1000
              : Date.parse(cand.lastUpdatedAt)
          ).toLocaleString()
        : "",
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Candidates");
    
    // Add headers
    const headers = Object.keys(formattedData[0] || {});
    worksheet.addRow(headers);
    
    // Add data rows
    formattedData.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
    
    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "mafia_candidates.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!authenticated) return;

    const startTime = performanceMonitor.startTimer();
    const q = query(collection(db, "candidates"), orderBy("regNo"), limit(1000)); // Limit for performance
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
      query(collection(db, "interviewers"), limit(100)), // Limit for performance
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



    // Cleanup old sessions (older than 2 hours)
    const cleanupOldSessions = async () => {
      try {
        const interviewersRef = collection(db, "interviewers");
        const snapshot = await getDocs(interviewersRef);
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        
        const deletePromises = snapshot.docs
          .filter(doc => {
            const lastActive = doc.data().lastActive;
            if (!lastActive) return true; // Delete if no lastActive timestamp
            
            const lastActiveTime = lastActive.seconds ? new Date(lastActive.seconds * 1000) : new Date(lastActive);
            return lastActiveTime < twoHoursAgo;
          })
          .map(doc => deleteDoc(doc.ref));
        
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          // Cleaned up old interviewer sessions - count logged securely
        }
      } catch (error) {
        console.error("Error cleaning up old sessions:", error);
      }
    };

    // Run cleanup every 30 minutes
    const cleanupInterval = setInterval(cleanupOldSessions, 30 * 60 * 1000);
    
    // Run initial cleanup
    cleanupOldSessions();

    return () => {
      unsub();
      clearInterval(cleanupInterval);
    };
  }, [authenticated]);

  // Optimized filter and search with memoization
  const filteredCandidates = useMemo(() => {
    const cacheKey = `filter_${search}_${filterPaid}_${candidates.length}`;
    const cachedResult = dataCache.get(cacheKey);
    
    if (cachedResult) {
      return cachedResult;
    }
    
    const result = candidates.filter((cand) => {
      const matchesSearch =
        !search ||
        cand.name?.toLowerCase().includes(search.toLowerCase()) ||
        cand.regNo?.toLowerCase().includes(search.toLowerCase());
      const matchesPaid =
        filterPaid === "all" ||
        (filterPaid === "paid" && cand.paid) ||
        (filterPaid === "unpaid" && !cand.paid);
      return matchesSearch && matchesPaid;
    });
    
    dataCache.set(cacheKey, result, 30 * 1000); // 30 seconds cache
    return result;
  }, [candidates, search, filterPaid, dataCache]);

  if (!authenticated) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.adminLoginCard}>
          <div style={styles.adminLoginHeader}>
            <div style={styles.adminBrandLogo} className="brand-logo">
              <img 
                src="/mafia-logo.png" 
                alt="MAFIA Logo" 
                style={styles.adminLogoImage}
                className="admin-logo-image"
              />
              <h2 style={styles.adminHeading} className="login-title">MAFIA</h2>
              <div style={styles.adminLogoSubtitle}>Admin Portal</div>
            </div>
            <p style={styles.adminSubtitle}>Secure Administrative Access</p>
          </div>
          
          <div style={styles.adminLoginContent}>
            <input
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.adminInput}
              className="admin-input"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.adminInput}
              className="admin-input"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              style={styles.adminButton} 
              className="admin-button"
            >
              {isLoggingIn ? (
                <>
                  <span className="loading-spinner" style={{ marginRight: "0.5rem" }}></span>
                  Logging In...
                </>
              ) : (
                "🔓 Access Admin Panel"
              )}
            </button>
            
            <div style={styles.adminFeatures}>
              <div style={styles.adminFeature} className="admin-feature">
                <span style={styles.adminFeatureIcon}>📊</span>
                <span>Real-time Analytics</span>
              </div>
              <div style={styles.adminFeature} className="admin-feature">
                <span style={styles.adminFeatureIcon}>👥</span>
                <span>Candidate Management</span>
              </div>
              <div style={styles.adminFeature} className="admin-feature">
                <span style={styles.adminFeatureIcon}>📥</span>
                <span>Data Export</span>
              </div>
              <div style={styles.adminFeature} className="admin-feature">
                <span style={styles.adminFeatureIcon}>🔧</span>
                <span>System Configuration</span>
              </div>
            </div>
            
            <div style={styles.contactInfo} className="contact-info">
              <div style={styles.contactHeader}>
                <span style={styles.contactIcon}>📞</span>
                <span style={styles.contactTitle}>Need Help?</span>
              </div>
              <p style={styles.contactText}>
                If you have any issues or questions, contact us at:
                <br />
                <span style={styles.contactNumber}>📱 9591185310</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
          <div style={styles.container}>
        <div style={styles.adminHeader}>
          <div>
            <div style={styles.adminDashboardBrand} className="dashboard-brand">
              <div style={styles.adminDashboardLogo}>
                <img 
                  src="/mafia-logo.png" 
                  alt="MAFIA Logo" 
                  style={styles.adminDashboardLogoImage}
                  className="admin-dashboard-logo-image"
                />
                <h1 style={styles.adminDashboardTitle} className="dashboard-title">MAFIA</h1>
              </div>
              <div style={styles.adminDashboardSubtitle}>Administrative Portal</div>
            </div>
            <p style={styles.adminStatusText}>
              Real-time monitoring • Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div style={styles.adminControls}>
            <div style={styles.statusIndicator}>
              <span style={styles.statusDot}></span>
              Live
            </div>
            <button 
              onClick={handleLogout}
              style={{
                ...styles.button,
                backgroundColor: "#cc0066",
                color: "white",
                fontSize: "0.9rem",
                padding: "0.5rem 1rem",
                marginLeft: "1rem"
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

      {/* Summary Cards */}
      <div style={styles.summaryRow}>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }} className="admin-card glass-effect">
          <div style={styles.cardTitle}>Total Candidates</div>
          <div style={styles.cardValue}>{total}</div>
          <div style={styles.cardSubtitle}>Registered Students</div>
        </div>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }} className="admin-card glass-effect">
          <div style={styles.cardTitle}>Paid</div>
          <div style={styles.cardValue}>
            {paid} <span style={{ color: "#00ff88", fontSize: "0.8em" }}>({percentPaid}%)</span>
          </div>
          <div style={styles.cardSubtitle}>Payment Confirmed</div>
        </div>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }} className="admin-card glass-effect">
          <div style={styles.cardTitle}>Unpaid</div>
          <div style={styles.cardValue}>{unpaid}</div>
          <div style={styles.cardSubtitle}>Pending Payment</div>
        </div>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }} className="admin-card glass-effect">
          <div style={styles.cardTitle}>Total Collected</div>
          <div style={styles.cardValue}>₹{totalAmount.toLocaleString()}</div>
          <div style={styles.cardSubtitle}>Revenue Generated</div>
        </div>
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" }} className="admin-card glass-effect">
          <div style={styles.cardTitle}>Manually Verified</div>
          <div style={styles.cardValue}>
            {manuallyVerified} <span style={{ color: "#00ff88", fontSize: "0.8em" }}>({paid > 0 ? Math.round((manuallyVerified / paid) * 100) : 0}%)</span>
          </div>
          <div style={styles.cardSubtitle}>Payment Confirmed</div>
        </div>
      </div>

      {/* Payment Analytics Chart */}
      <div style={{ margin: "2rem 0", textAlign: "center" }}>
        <h3 style={{ color: "#999", marginBottom: "1rem" }}>Payment Analytics</h3>
        <svg width="220" height="120">
          <rect x="10" y="20" width="60" height={paid / total * 80 || 0} fill="#00ff88" />
          <rect x="90" y="20" width="60" height={unpaid / total * 80 || 0} fill="#ff6b6b" />
          <text x="40" y="115" fill="#00ff88" fontSize="16">Paid</text>
          <text x="120" y="115" fill="#ff6b6b" fontSize="16">Unpaid</text>
        </svg>
        <div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
          Total Revenue: ₹{totalAmount.toLocaleString()}
        </div>
      </div>



      {/* Admin Actions Section */}
      <div style={styles.adminActionsSection}>
        <h3 style={styles.sectionTitle}>🔧 Administrative Actions</h3>
        <div style={styles.adminActions}>
          <button onClick={exportToExcel} style={styles.primaryButton} className="admin-button primaryButton">
            📥 Export Filtered Data to Excel
          </button>
          <button 
            onClick={clearAllInterviewerData}
            disabled={isClearDataLoading}
            style={{
              ...styles.dangerButton,
              backgroundColor: isClearDataLoading ? "#666" : "#dc3545",
              color: "white",
              marginLeft: "1rem"
            }}
            className="admin-button dangerButton"
          >
            {isClearDataLoading ? (
              <>
                <span className="loading-spinner" style={{ marginRight: "0.5rem" }}></span>
                Clearing Data...
              </>
            ) : (
              "🗑️ Clear All Interviewer Data"
            )}
          </button>
          <button 
            onClick={clearAllCandidateData} 
            style={{
              ...styles.dangerButton,
              backgroundColor: "#ff4444",
              color: "white",
              marginLeft: "1rem"
            }}
            className="admin-button dangerButton"
          >
            🗑️ Clear All Candidate Data
          </button>
        </div>
        <div style={styles.actionDescription}>
          <p style={styles.descriptionText}>
            <strong>Clear All Interviewer Data:</strong> Removes payment confirmations, interview verdicts, and comments while preserving candidate information.
          </p>
          <p style={styles.descriptionText}>
            <strong>Clear All Candidate Data:</strong> Completely removes all candidate records from the database.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterRow}>
        <input
          style={styles.input}
          placeholder="Search by name or reg no"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.input}
          value={filterPaid}
          onChange={(e) => setFilterPaid(e.target.value)}
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>



      {/* Active Interviewers Section */}
      <div style={styles.interviewersSection}>
        <div style={styles.interviewersHeader}>
          <h2 style={styles.subheading}>👥 Active Interviewers ({interviewers.length})</h2>
                      <button 
              onClick={forceLogoutAllInterviewers}
              disabled={isForceLogoutLoading}
              className="admin-button"
              style={{
                ...styles.button,
                backgroundColor: isForceLogoutLoading ? "#666" : "#ff4444",
                color: "white",
                fontSize: "0.9rem",
                padding: "0.5rem 1rem"
              }}
            >
            {isForceLogoutLoading ? (
              <>
                <span className="loading-spinner" style={{ marginRight: "0.5rem" }}></span>
                Force Logging Out...
              </>
            ) : (
              "🚫 Force Logout All"
            )}
          </button>
        </div>
        
        {interviewers.length > 0 ? (
          <div style={styles.interviewersList}>
                         {interviewers.map((interviewer, idx) => (
               <div key={idx} style={styles.interviewerCard} className="interviewer-card">
                <div style={styles.interviewerEmail}>{interviewer.email}</div>
                <div style={styles.interviewerTime}>
                  Last Active: {interviewer.lastActive ? new Date(interviewer.lastActive.seconds * 1000).toLocaleString() : "Unknown"}
                </div>
                <div style={styles.interviewerTime}>
                  Login Time: {interviewer.loginTime ? new Date(interviewer.loginTime.seconds * 1000).toLocaleString() : "Unknown"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.noInterviewers}>No active interviewers</div>
        )}
      </div>

      <h2 style={styles.subheading}>📋 Candidates ({filteredCandidates.length})</h2>
      <div style={{ 
        overflowX: "auto", 
        maxWidth: "100%", 
        border: "2px solid rgba(255,255,255,0.2)", 
        borderRadius: "8px",
        padding: "10px",
        backgroundColor: "rgba(255,255,255,0.05)"
      }}>
        <table style={styles.table} className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Reg No</th>
              <th>Year</th>
              <th>College</th>
              <th>Branch</th>
              <th>WhatsApp</th>
              <th>Paid</th>
              <th style={{ backgroundColor: "rgba(255, 193, 7, 0.2)", color: "#ffc107" }}>Verified</th>
              <th>Amount</th>
              <th>Method</th>
              <th>UPI ID</th>
              <th>Code</th>
              <th>TalentComm Prefs</th>
              <th>WorkComm Prefs</th>
              <th>TalentComm Verdict</th>
              <th>WorkComm Verdict</th>
              <th>Comments</th>
              <th>Last Updated By</th>
              <th>Last Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.map((cand, index) => (
              <tr key={index} style={{ backgroundColor: cand.paid ? "#1a2a1a" : "#1a1a1a" }}>
                <td>{cand.name}</td>
                <td>{cand.regNo}</td>
                <td>
                  <span style={{
                    padding: "4px 8px",
                    borderRadius: "12px",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                    backgroundColor: cand.year === "1st year" ? "#4CAF50" : "#2196F3",
                    color: "white"
                  }}>
                    {cand.year || "Not specified"}
                  </span>
                </td>
                <td>{cand.college || "N/A"}</td>
                <td>{cand.branch || "N/A"}</td>
                <td>{cand.whatsappNumber || "N/A"}</td>
                <td>{cand.paid ? "✅" : "❌"}</td>
                <td>
                  {cand.paid ? (
                    cand.manuallyVerified ? (
                      <span style={{ color: "#00ff88", fontWeight: "bold" }}>✅ Verified</span>
                    ) : (
                      <span style={{ color: "#ffaa00", fontWeight: "bold" }}>⏳ Pending</span>
                    )
                  ) : (
                    <span style={{ color: "#666" }}>N/A</span>
                  )}
                </td>
                <td>{cand.paymentDetails?.amount || ""}</td>
                <td>{cand.paymentDetails?.method || ""}</td>
                <td>{cand.paymentDetails?.upiId || ""}</td>
                <td>{cand.paymentDetails?.verificationCode || ""}</td>
                <td style={{ padding: "8px", verticalAlign: "top" }}>
                  {cand.preferences?.talentComm?.pref1 ? (
                    <div>
                      <div style={{fontSize: "0.9rem", fontWeight: "bold", color: "#4CAF50", marginBottom: "2px"}}>
                        1. {cand.preferences.talentComm.pref1}
                      </div>
                      {cand.preferences?.talentComm?.pref2 && (
                        <div style={{fontSize: "0.9rem", fontWeight: "bold", color: "#4CAF50"}}>
                          2. {cand.preferences.talentComm.pref2}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{color: "#888", fontStyle: "italic"}}>No preferences</span>
                  )}
                </td>
                <td style={{ padding: "8px", verticalAlign: "top" }}>
                  {cand.year === "2nd year" ? (
                    <span style={{color: "#888", fontStyle: "italic"}}>N/A (2nd year)</span>
                  ) : cand.preferences?.workComm?.pref1 ? (
                    <div>
                      <div style={{fontSize: "0.9rem", fontWeight: "bold", color: "#2196F3", marginBottom: "2px"}}>
                        1. {cand.preferences.workComm.pref1}
                      </div>
                      {cand.preferences?.workComm?.pref2 && (
                        <div style={{fontSize: "0.9rem", fontWeight: "bold", color: "#2196F3", marginBottom: "2px"}}>
                          2. {cand.preferences.workComm.pref2}
                        </div>
                      )}
                      {cand.preferences?.workComm?.pref3 && (
                        <div style={{fontSize: "0.9rem", fontWeight: "bold", color: "#2196F3"}}>
                          3. {cand.preferences.workComm.pref3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{color: "#888", fontStyle: "italic"}}>No preferences</span>
                  )}
                </td>
                <td>
                  {Array.isArray(cand.verdict?.talentComm)
                    ? cand.verdict.talentComm.join(", ")
                    : ""}
                </td>
                <td>
                  {Array.isArray(cand.verdict?.workComm)
                    ? cand.verdict.workComm.join(", ")
                    : ""}
                </td>
                <td>{cand.comments || ""}</td>
                <td>{cand.lastUpdatedBy || "N/A"}</td>
                <td>
                  {cand.lastUpdatedAt
                    ? new Date(
                        cand.lastUpdatedAt.seconds
                          ? cand.lastUpdatedAt.seconds * 1000
                          : Date.parse(cand.lastUpdatedAt)
                      ).toLocaleString()
                    : ""}
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {cand.paid && !cand.manuallyVerified && (
                      <button
                        onClick={() => manuallyVerifyPayment(cand)}
                        style={{
                          ...styles.button,
                          backgroundColor: "#4CAF50",
                          color: "white",
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          margin: "0"
                        }}
                        title="Manually verify payment"
                      >
                        ✅ Verify
                      </button>
                    )}
                    {cand.paid && cand.manuallyVerified && (
                      <button
                        onClick={() => unverifyPayment(cand)}
                        style={{
                          ...styles.button,
                          backgroundColor: "#ff9800",
                          color: "white",
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          margin: "0"
                        }}
                        title="Remove manual verification"
                      >
                        🔄 Unverify
                      </button>
                    )}
                    {cand.paid && (
                      <button
                        onClick={() => reversePaymentForCandidate(cand)}
                        style={{
                          ...styles.button,
                          backgroundColor: "#cc0066",
                          color: "white",
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          margin: "0"
                        }}
                        title="Reverse payment confirmation"
                      >
                        🔄 Reverse
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    backgroundColor: "#0a0a1a",
    background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
    minHeight: "100vh",
    color: "white",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loginContainer: {
    padding: "2rem",
    backgroundColor: "#0d0d0d",
    color: "white",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)",
  },
  adminLoginCard: {
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
  adminLoginHeader: {
    marginBottom: "2.5rem",
  },
  adminBrandLogo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  adminLogoImage: {
    width: "70px",
    height: "70px",
    objectFit: "contain",
    filter: "drop-shadow(0 0 15px rgba(204, 0, 204, 0.5))",
  },
  adminLogoSubtitle: {
    fontSize: "1rem",
    color: "#cc00cc",
    fontWeight: "500",
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginTop: "-0.5rem",
  },
  adminHeading: {
    color: "#cc00cc",
    marginBottom: "0.5rem",
    fontSize: "2.5rem",
    fontWeight: "bold",
    textShadow: "0 0 20px rgba(204, 0, 204, 0.5)",
    letterSpacing: "2px",
  },
  adminSubtitle: {
    color: "#999",
    fontSize: "1.1rem",
    margin: 0,
    fontWeight: "300",
    letterSpacing: "1px",
  },
  adminLoginContent: {
    marginBottom: "2rem",
  },
  adminInput: {
    padding: "1rem",
    marginBottom: "1.5rem",
    borderRadius: "12px",
    width: "100%",
    backgroundColor: "rgba(26, 26, 26, 0.8)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    fontSize: "1rem",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
  },
  adminButton: {
    padding: "1.2rem 2rem",
    backgroundColor: "#800080",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    marginBottom: "2rem",
    fontSize: "1.1rem",
    fontWeight: "500",
    letterSpacing: "0.5px",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 25px rgba(128, 0, 128, 0.4)",
    width: "100%",
  },
  adminFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
    marginBottom: "2rem",
  },
  adminFeature: {
    display: "flex",
    alignItems: "center",
    gap: "0.8rem",
    color: "#aaa",
    fontSize: "0.95rem",
    padding: "0.5rem",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },
  adminFeatureIcon: {
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
    color: "#cc00cc",
  },
  contactTitle: {
    color: "#cc00cc",
    fontWeight: "bold",
    fontSize: "1rem",
  },
  contactText: {
    color: "#999",
    fontSize: "0.9rem",
    margin: 0,
    lineHeight: "1.5",
  },
  contactNumber: {
    color: "#cc00cc",
    fontWeight: "bold",
    fontSize: "1.1rem",
    textShadow: "0 0 10px rgba(204, 0, 204, 0.3)",
  },
  heading: {
    color: "#cc00cc",
    marginBottom: "1rem",
  },
  subheading: {
    color: "#999",
    marginTop: "2rem",
    marginBottom: "0.5rem",
  },
  input: {
    padding: "0.5rem",
    marginBottom: "1rem",
    borderRadius: "8px",
    width: "250px",
    backgroundColor: "#1a1a1a",
    color: "white",
    border: "1px solid #333",
  },
  button: {
    padding: "0.6rem 1rem",
    backgroundColor: "#800080",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "1rem",
  },
  summaryRow: {
    display: "flex",
    gap: "1.5rem",
    margin: "2rem 0 1rem 0",
    flexWrap: "wrap",
  },
  card: {
    flex: 1,
    minWidth: "200px",
    borderRadius: "16px",
    padding: "1.5rem",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
    marginBottom: "1rem",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    transition: "all 0.3s ease",
    position: "relative",
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: "0.9rem",
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: "0.5rem",
    textTransform: "uppercase",
    letterSpacing: "1px",
    fontWeight: "600",
  },
  cardValue: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: "0.5rem",
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
  },
  cardSubtitle: {
    fontSize: "0.8rem",
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
  },
  sectionTitle: {
    color: "#cc00cc",
    fontSize: "1.3rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    textShadow: "0 0 10px rgba(204, 0, 204, 0.3)",
  },
  adminActionsSection: {
    margin: "2rem 0",
    padding: "2rem",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  adminActions: {
    display: "flex",
    gap: "1rem",
    margin: "1rem 0",
    alignItems: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "0.8rem 1.5rem",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: "600",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(76, 175, 80, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 6px 20px rgba(76, 175, 80, 0.4)",
    },
  },
  dangerButton: {
    padding: "0.8rem 1.5rem",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: "600",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(220, 53, 69, 0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  actionDescription: {
    marginTop: "1.5rem",
    padding: "1rem",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },
  descriptionText: {
    margin: "0.5rem 0",
    color: "#b0b0b0",
    fontSize: "0.9rem",
    lineHeight: "1.5",
  },
  filterRow: {
    display: "flex",
    gap: "1rem",
    margin: "1rem 0",
    alignItems: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "1rem",
    fontSize: "0.9rem",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
  },
  th: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "1rem 0.8rem",
    textAlign: "left",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontSize: "0.85rem",
    color: "#fff",
  },
  td: {
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "0.8rem",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    transition: "background-color 0.2s ease",
  },
  interviewersSection: {
    marginTop: "2rem",
    padding: "2rem",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  interviewersHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  interviewersList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "1rem",
  },
  interviewerCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "1.5rem",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(5px)",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
  },
  interviewerEmail: {
    fontWeight: "bold",
    color: "#00ff88",
    marginBottom: "0.5rem",
  },
  interviewerTime: {
    fontSize: "0.9rem",
    color: "#aaa",
    marginBottom: "0.25rem",
  },
  noInterviewers: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
    padding: "2rem",
  },

  adminHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "2rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #333",
  },
  adminDashboardBrand: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  adminDashboardLogo: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  adminDashboardLogoImage: {
    width: "50px",
    height: "50px",
    objectFit: "contain",
    filter: "drop-shadow(0 0 15px rgba(204, 0, 204, 0.5))",
  },
  adminDashboardTitle: {
    color: "#cc00cc",
    margin: 0,
    fontSize: "2.2rem",
    fontWeight: "bold",
    textShadow: "0 0 20px rgba(204, 0, 204, 0.3)",
    letterSpacing: "2px",
  },
  adminDashboardSubtitle: {
    color: "#999",
    margin: 0,
    fontSize: "1rem",
    fontWeight: "300",
    letterSpacing: "1px",
  },
  adminStatusText: {
    color: "#666",
    margin: "0.5rem 0 0 0",
    fontSize: "0.9rem",
  },
  adminControls: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  statusIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "#00ff88",
    fontSize: "0.9rem",
    fontWeight: "bold",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#00ff88",
    borderRadius: "50%",
    animation: "pulse 2s infinite",
  },
};

export default AdminPortal;
