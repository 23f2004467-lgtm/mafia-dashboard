import React, { useEffect, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { FirebaseSecurity } from './security';
import { SecureAdminAuth } from './secureAdminAuth';
import { Button, Card, Input, Select, Badge, StatusBadge, Modal, ConfirmDialog } from './components/common';
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

/**
 * MAFIA Recruitment Admin Portal
 * Professional dashboard for managing recruitment process
 */
function AdminPortal() {
  // Performance optimizations
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

  // Modal states
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

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

  // Handlers
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

      alert(`✅ Successfully cleared all interviewer data for ${snapshot.docs.length} candidates!`);
      setShowClearDataModal(false);
    } catch (error) {
      console.error('Error clearing interviewer data:', error);
      alert('❌ Failed to clear interviewer data: ' + error.message);
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
      alert("✅ All interviewers have been force logged out successfully!");
    } catch (error) {
      console.error("Error force logging out interviewers:", error);
      alert("❌ Error force logging out interviewers: " + error.message);
    } finally {
      setIsForceLogoutLoading(false);
    }
  };

  const clearAllCandidateData = async () => {
    try {
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);

      if (snapshot.empty) {
        alert("ℹ️ No candidate data found to delete.");
        return;
      }

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      const paymentSessionsRef = collection(db, "paymentSessions");
      const paymentSnapshot = await getDocs(paymentSessionsRef);
      const paymentDeletePromises = paymentSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentDeletePromises);

      alert(`✅ Successfully deleted ${snapshot.docs.length} candidate records and ${paymentSnapshot.docs.length} payment sessions!`);

      FirebaseSecurity.auditLogger.logEvent('admin_cleared_all_data', {
        timestamp: new Date().toISOString(),
        adminEmail: email,
        candidatesDeleted: snapshot.docs.length,
        paymentSessionsDeleted: paymentSnapshot.docs.length
      });

      setShowDeleteDataModal(false);
    } catch (error) {
      console.error("Error clearing candidate data:", error);
      alert("❌ Error clearing candidate data: " + error.message);
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
      alert('❌ Failed to manually verify payment: ' + error.message);
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

  // Effects
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

  // Styles
  const styles = {
    container: {
      padding: "2rem",
      background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
      minHeight: "100vh",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
      paddingBottom: "1rem",
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "1rem",
    },
    logo: {
      width: "50px",
      height: "50px",
      objectFit: "contain",
      filter: "drop-shadow(0 0 15px rgba(204, 0, 204, 0.5))",
    },
    title: {
      color: "#cc00cc",
      fontSize: "2rem",
      fontWeight: "bold",
      margin: 0,
      textShadow: "0 0 20px rgba(204, 0, 204, 0.3)",
    },
    subtitle: {
      color: "#999",
      fontSize: "0.9rem",
      margin: "0.25rem 0 0 0",
    },
    statusIndicator: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      color: "#00ff88",
      fontSize: "0.9rem",
    },
    statusDot: {
      width: "8px",
      height: "8px",
      backgroundColor: "#00ff88",
      borderRadius: "50%",
      animation: "pulse 2s infinite",
    },
    filtersRow: {
      display: "flex",
      gap: "1rem",
      marginBottom: "1.5rem",
      flexWrap: "wrap",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "1.5rem",
      marginBottom: "2rem",
    },
    section: {
      marginBottom: "2rem",
    },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1rem",
    },
    sectionTitle: {
      color: "#cc00cc",
      fontSize: "1.5rem",
      fontWeight: "bold",
      margin: 0,
    },
    actionsRow: {
      display: "flex",
      gap: "1rem",
      flexWrap: "wrap",
    },
    interviewersGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: "1rem",
    },
    interviewerCard: {
      background: "rgba(255, 255, 255, 0.05)",
      padding: "1rem",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
  };

  // Login View
  if (!authenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
      }}>
        <Card variant="elevated" padding="xl" style={{ maxWidth: "450px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <img
              src="/mafia-logo.png"
              alt="MAFIA Logo"
              style={{ width: "70px", height: "70px", objectFit: "contain", marginBottom: "1rem" }}
            />
            <h1 style={{ color: "#cc00cc", fontSize: "2.5rem", fontWeight: "bold", margin: 0 }}>
              MAFIA
            </h1>
            <div style={{ color: "#cc00cc", fontSize: "0.9rem", fontWeight: "500", letterSpacing: "2px", textTransform: "uppercase" }}>
              ADMIN PORTAL
            </div>
            <p style={{ color: "#999", fontSize: "1rem", marginTop: "1rem", margin: 0 }}>
              Secure Administrative Access
            </p>
          </div>

          <Input
            label="Email Address"
            type="email"
            placeholder="admin@mafia.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleLogin}
            loading={isLoggingIn}
            style={{ marginTop: "1rem" }}
          >
            Access Admin Panel
          </Button>

          <div style={{
            marginTop: "2rem",
            padding: "1rem",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "12px",
            textAlign: "center",
            border: "1px solid rgba(255, 255, 255, 0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span>📞</span>
              <span style={{ color: "#cc00cc", fontWeight: "bold" }}>Need Help?</span>
            </div>
            <p style={{ color: "#999", fontSize: "0.9rem", margin: 0 }}>
              Contact: <span style={{ color: "#cc00cc", fontWeight: "bold" }}>📱 9591185310</span>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Dashboard View
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/mafia-logo.png" alt="MAFIA Logo" style={styles.logo} />
          <div>
            <h1 style={styles.title}>MAFIA</h1>
            <div style={styles.subtitle}>Recruitment Admin Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={styles.statusIndicator}>
            <span style={styles.statusDot}></span>
            Live • Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button variant="secondary" onClick={handleLogout} size="sm">
            🚪 Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <Card
          variant="gradient"
          gradient="primary"
          padding="lg"
          style={{ position: "relative", overflow: "hidden" }}
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Total Candidates
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{total}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Registered Students</div>
        </Card>

        <Card
          variant="gradient"
          gradient="success"
          padding="lg"
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Paid
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
            {paid} <span style={{ fontSize: "1rem", opacity: 0.9 }}>({percentPaid}%)</span>
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Payment Confirmed</div>
        </Card>

        <Card
          variant="gradient"
          gradient="warning"
          padding="lg"
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Unpaid
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{unpaid}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Pending Payment</div>
        </Card>

        <Card
          variant="gradient"
          gradient="info"
          padding="lg"
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Total Collected
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>₹{totalAmount.toLocaleString()}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Revenue Generated</div>
        </Card>

        <Card
          variant="gradient"
          gradient="primary"
          padding="lg"
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>
            Manually Verified
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
            {manuallyVerified} <span style={{ fontSize: "1rem", opacity: 0.9 }}>({paid > 0 ? Math.round((manuallyVerified / paid) * 100) : 0}%)</span>
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Payment Verified</div>
        </Card>
      </div>

      {/* Admin Actions */}
      <Card variant="glass" padding="lg" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#cc00cc", fontSize: "1.3rem", fontWeight: "bold", marginBottom: "1rem", margin: 0 }}>
          🔧 Administrative Actions
        </h3>
        <div style={styles.actionsRow}>
          <Button variant="success" onClick={exportToExcel}>
            📥 Export to Excel
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowClearDataModal(true)}
            loading={isClearDataLoading}
          >
            🗑️ Clear Interviewer Data
          </Button>
          <Button
            variant="danger"
            onClick={() => setShowDeleteDataModal(true)}
          >
            🗑️ Clear All Data
          </Button>
        </div>
      </Card>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <Input
          placeholder="Search by name or reg no"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <Select
          value={filterPaid}
          onChange={(e) => setFilterPaid(e.target.value)}
          style={{ minWidth: "150px" }}
        >
          <option value="all">All Candidates</option>
          <option value="paid">Paid Only</option>
          <option value="unpaid">Unpaid Only</option>
        </Select>
      </div>

      {/* Active Interviewers */}
      <Card variant="glass" padding="lg" style={{ marginBottom: "2rem" }}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            👥 Active Interviewers ({interviewers.length})
          </h3>
          <Button
            variant="danger"
            size="sm"
            onClick={forceLogoutAllInterviewers}
            loading={isForceLogoutLoading}
          >
            🚫 Force Logout All
          </Button>
        </div>

        {interviewers.length > 0 ? (
          <div style={styles.interviewersGrid}>
            {interviewers.map((interviewer, idx) => (
              <div key={idx} style={styles.interviewerCard}>
                <div style={{ fontWeight: "bold", color: "#00ff88", marginBottom: "0.5rem" }}>
                  {interviewer.email}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#999" }}>
                  Last Active: {interviewer.lastActive ? new Date(interviewer.lastActive.seconds * 1000).toLocaleString() : "Unknown"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#666", padding: "2rem" }}>
            No active interviewers
          </div>
        )}
      </Card>

      {/* Candidates Table */}
      <Card variant="glass" padding="lg">
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>
            📋 Candidates ({filteredCandidates.length})
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255, 255, 255, 0.1)" }}>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Name</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Reg No</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Year</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Paid</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Status</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Verdict</th>
                <th style={{ padding: "1rem", textAlign: "left", color: "#999", fontWeight: "600", textTransform: "uppercase", fontSize: "0.75rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((cand, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    backgroundColor: cand.paid ? "rgba(76, 175, 80, 0.1)" : "transparent",
                  }}
                >
                  <td style={{ padding: "1rem" }}>{cand.name}</td>
                  <td style={{ padding: "1rem" }}>{cand.regNo}</td>
                  <td style={{ padding: "1rem" }}>
                    <Badge variant={cand.year === "1st year" ? "success" : "info"} size="sm">
                      {cand.year || "N/A"}
                    </Badge>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {cand.paid ? <StatusBadge status="paid" /> : <StatusBadge status="unpaid" />}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {cand.paid ? (
                      cand.manuallyVerified ? (
                        <StatusBadge status="verified" />
                      ) : (
                        <StatusBadge status="pending" />
                      )
                    ) : (
                      <span style={{ color: "#666" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {Array.isArray(cand.verdict?.talentComm) && cand.verdict.talentComm.length > 0 ? (
                      <Badge variant="success" size="sm">
                        {cand.verdict.talentComm.join(", ")}
                      </Badge>
                    ) : (
                      <span style={{ color: "#666" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {cand.paid && !cand.manuallyVerified && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => manuallyVerifyPayment(cand)}
                      >
                        ✅ Verify
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modals */}
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default AdminPortal;
