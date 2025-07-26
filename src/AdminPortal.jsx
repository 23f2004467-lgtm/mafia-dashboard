import React, { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import * as XLSX from "xlsx";

const ADMIN_PASSWORD = "mafiaadmin2025";

function AdminPortal() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [interviewers, setInterviewers] = useState([]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      alert("Incorrect password.");
    }
  };

  const exportToExcel = () => {
    const formattedData = candidates.map((cand) => ({
      Name: cand.name || "",
      RegNo: cand.regNo || "",
      Year: cand.year || "",
      Paid: cand.paid ? "Yes" : "No",
      TalentComm: Array.isArray(cand.verdict?.talentComm)
        ? cand.verdict.talentComm.join(", ")
        : String(cand.verdict?.talentComm || ""),
      WorkComm: Array.isArray(cand.verdict?.workComm)
        ? cand.verdict.workComm.join(", ")
        : String(cand.verdict?.workComm || ""),
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

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
    XLSX.writeFile(workbook, "mafia_candidates.xlsx");
  };

  useEffect(() => {
    if (!authenticated) return;

    const q = query(collection(db, "candidates"), orderBy("regNo"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setCandidates(data);
    });

    return () => unsub();
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;

    const unsub = onSnapshot(collection(db, "interviewers"), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.id);
      setInterviewers(data);
    });

    return () => unsub();
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div style={styles.loginContainer}>
        <h2 style={styles.heading}>🔐 Admin Login</h2>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleLogin} style={styles.button}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🛠 Admin Portal</h1>

      <button onClick={exportToExcel} style={styles.button}>
        📥 Export Candidate Data to Excel
      </button>

      <h2 style={styles.subheading}>👥 Logged-in Interviewers ({interviewers.length})</h2>
      <ul>
        {interviewers.map((email, idx) => (
          <li key={idx}>{email}</li>
        ))}
      </ul>

      <h2 style={styles.subheading}>📋 All Candidates ({candidates.length})</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Reg No</th>
              <th>Year</th>
              <th>Paid</th>
              <th>TalentComm</th>
              <th>WorkComm</th>
              <th>Comments</th>
              <th>Last Updated By</th>
              <th>Last Updated At</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((cand, idx) => (
              <tr key={idx}>
                <td>{cand.name}</td>
                <td>{cand.regNo}</td>
                <td>{cand.year}</td>
                <td>{cand.paid ? "✅" : "❌"}</td>
                <td>
                  {Array.isArray(cand.verdict?.talentComm)
                    ? cand.verdict.talentComm.join(", ")
                    : String(cand.verdict?.talentComm || "")}
                </td>
                <td>
                  {Array.isArray(cand.verdict?.workComm)
                    ? cand.verdict.workComm.join(", ")
                    : String(cand.verdict?.workComm || "")}
                </td>
                <td>{cand.comments}</td>
                <td>{cand.lastUpdatedBy}</td>
                <td>
                  {cand.lastUpdatedAt
                    ? new Date(
                        cand.lastUpdatedAt.seconds
                          ? cand.lastUpdatedAt.seconds * 1000
                          : Date.parse(cand.lastUpdatedAt)
                      ).toLocaleString()
                    : ""}
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
    backgroundColor: "#0d0d0d",
    color: "white",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif",
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "1rem",
  },
  th: {
    backgroundColor: "#222",
    borderBottom: "1px solid #555",
    padding: "0.5rem",
  },
  td: {
    borderBottom: "1px solid #444",
    padding: "0.5rem",
  },
};

export default AdminPortal;
