import { useEffect, useState } from "react";
import { auth, provider, db } from "./firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  onSnapshot
} from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("formData");
    return saved
      ? JSON.parse(saved)
      : {
          name: "",
          regNo: "",
          year: "",
          preferences: [],
          verdict: {
            talentComm: [],
            workComm: [],
          },
          comments: "",
          paid: false,
          lastUpdatedBy: "",
          lastUpdatedAt: ""
        };
  });

  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    localStorage.setItem("formData", JSON.stringify(formData));
  }, [formData]);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  };

  const handleVerdictChange = (type, domain) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.verdict[type]) ? prev.verdict[type] : [];
      return {
        ...prev,
        verdict: {
          ...prev.verdict,
          [type]: current.includes(domain)
            ? current.filter((d) => d !== domain)
            : [...current, domain],
        },
      };
    });
  };

  const handleSearch = () => {
    if (!searchName) return;

    const ref = collection(db, "candidates");

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const filtered = snapshot.docs
        .map((doc) => doc.data())
        .filter((candidate) =>
          candidate.name?.toLowerCase().includes(searchName.toLowerCase())
        );
      setSearchResults(filtered);
      setVisibleCount(3);
    });

    return () => unsubscribe();
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSearchName("");
  };

  const handleSubmit = async () => {
    try {
      const ref = doc(db, "candidates", formData.regNo);
      const payload = {
        ...formData,
        lastUpdatedBy: user?.email || "",
        lastUpdatedAt: new Date().toISOString(),
      };
      await setDoc(ref, payload);
      alert("✅ Data saved successfully!");
      setFormData({
        name: "",
        regNo: "",
        year: "",
        preferences: [],
        verdict: {
          talentComm: [],
          workComm: [],
        },
        comments: "",
        paid: false,
        lastUpdatedBy: "",
        lastUpdatedAt: ""
      });
      localStorage.removeItem("formData");
    } catch (err) {
      alert("Error saving data: " + err.message);
    }
  };

  return (
    <div style={{ backgroundColor: "#0d0d0d", color: "white", minHeight: "100vh", padding: "2rem" }}>
      {!user ? (
        <button
          onClick={login}
          style={{ backgroundColor: "#800080", color: "white", padding: "1rem", borderRadius: "8px" }}
        >
          Login with Gmail
        </button>
      ) : (
        <div style={{ maxWidth: "600px", margin: "auto" }}>
          <h1 style={{ color: "#cc0066" }}>MAFIA Interviewer Dashboard</h1>

          <h2>🔍 Search Candidate by Name</h2>
          <input
            style={styles.input}
            placeholder="Enter name to search"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              style={{ ...styles.button, backgroundColor: "#444" }}
              onClick={handleSearch}
            >
              Search
            </button>
            <button
              style={{ ...styles.button, backgroundColor: "#222" }}
              onClick={clearSearch}
            >
              Cancel
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3>Matching Candidates:</h3>
              {searchResults.slice(0, visibleCount).map((cand, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                >
                  <strong>{cand.name}</strong> ({cand.regNo}) - Year: {cand.year}<br />
                  <div style={{ marginTop: "0.25rem" }}>
                    <strong>TalentComm:</strong> {Array.isArray(cand.verdict?.talentComm) ? cand.verdict.talentComm.join(", ") : ""}<br />
                    <strong>WorkComm:</strong> {Array.isArray(cand.verdict?.workComm) ? cand.verdict.workComm.join(", ") : ""}<br />
                    <strong>Paid:</strong> {cand.paid ? "✅" : "❌"}<br />
                    <strong>Last Updated By:</strong> {cand.lastUpdatedBy || "N/A"}<br />
                    <strong>Last Updated At:</strong> {cand.lastUpdatedAt ? new Date(cand.lastUpdatedAt).toLocaleString() : "N/A"}
                  </div>
                  <button
                    style={{ ...styles.button, backgroundColor: "#cc0066", marginTop: "0.5rem" }}
                    onClick={() => setFormData(cand)}
                  >
                    Load to Form
                  </button>
                </div>
              ))}
              {visibleCount < searchResults.length && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 3)}
                  style={{ ...styles.button, backgroundColor: "#555" }}
                >
                  Load More
                </button>
              )}
            </div>
          )}

          <label>Name</label>
          <input
            style={styles.input}
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <label>Reg No</label>
          <input
            style={styles.input}
            type="text"
            value={formData.regNo}
            onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
          />

          <label>Year</label>
          <input
            style={styles.input}
            type="text"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
          />

          <label>TalentComm Domains</label>
          <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {["Dance", "Music", "Art"].map((domain) => (
              <button
                key={domain}
                onClick={() => handleVerdictChange("talentComm", domain)}
                style={{
                  ...styles.button,
                  backgroundColor: Array.isArray(formData.verdict.talentComm) && formData.verdict.talentComm.includes(domain)
                    ? "green"
                    : "#800080",
                }}
              >
                {domain}
              </button>
            ))}
          </div>

          <label>WorkComm Domains</label>
          <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {["Human Resources", "Public Relations", "Social Media and Graphic Design", "Photography and Videography"].map((domain) => (
              <button
                key={domain}
                onClick={() => handleVerdictChange("workComm", domain)}
                style={{
                  ...styles.button,
                  backgroundColor: Array.isArray(formData.verdict.workComm) && formData.verdict.workComm.includes(domain)
                    ? "green"
                    : "#800000",
                }}
              >
                {domain}
              </button>
            ))}
          </div>

          <label>
            <input
              type="checkbox"
              checked={formData.paid}
              onChange={(e) => setFormData({ ...formData, paid: e.target.checked })}
            />
            &nbsp; Mark as Paid
          </label>

          <label>Comments</label>
          <textarea
            style={styles.input}
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            placeholder="Enter notes about their talent..."
          ></textarea>

          <button
            onClick={handleSubmit}
            style={{ ...styles.button, marginTop: "1rem", backgroundColor: "#cc0066" }}
          >
            Submit
          </button>
        </div>
      )}
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
    backgroundColor: "#1a1a1a",
    color: "white",
  },
  button: {
    padding: "0.6rem 1rem",
    borderRadius: "8px",
    border: "none",
    color: "white",
    cursor: "pointer",
  },
};

export default App;
