import React from 'react';

function DebugPage() {
  return (
    <div style={{
      padding: "2rem",
      backgroundColor: "#0d0d0d",
      color: "white",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column"
    }}>
      <h1 style={{ color: "#00ff88", marginBottom: "2rem" }}>✅ React is Working!</h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>If you can see this, React is loading properly.</p>
      
      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ color: "#cc00cc" }}>Available Routes:</h2>
        <ul style={{ textAlign: "left", lineHeight: "1.8" }}>
          <li><a href="/" style={{ color: "#00ff88" }}>/</a> - Main App</li>
          <li><a href="/setup" style={{ color: "#00ff88" }}>/setup</a> - Admin Setup</li>
          <li><a href="/admin" style={{ color: "#00ff88" }}>/admin</a> - Admin Portal</li>
        </ul>
      </div>
      
      <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: "8px" }}>
        <h3 style={{ color: "#ffaa00" }}>Next Steps:</h3>
        <p>Click on <a href="/setup" style={{ color: "#00ff88", fontWeight: "bold" }}>/setup</a> to set up your admin account.</p>
      </div>
    </div>
  );
}

export default DebugPage;

