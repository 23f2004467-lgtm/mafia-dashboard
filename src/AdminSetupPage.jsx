import React, { useState } from 'react';
import { AdminSetup } from './adminSetup';

function AdminSetupPage() {
  const [email, setEmail] = useState('dheera1312@gmail.com');
  const [password, setPassword] = useState('mafiaadmin2025');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState(null);

  const handleCreateAdmin = async () => {
    setIsCreating(true);
    setResult(null);
    
    try {
      const result = await AdminSetup.createAdminUser(email, password);
      setResult(result);
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTestLogin = async () => {
    setIsCreating(true);
    setResult(null);
    
    try {
      const result = await AdminSetup.testAdminLogin(email, password);
      setResult(result);
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleVerifySetup = async () => {
    setIsCreating(true);
    setResult(null);
    
    try {
      const result = await AdminSetup.verifyAdminSetup(email);
      setResult(result);
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      padding: "2rem",
      backgroundColor: "#0d0d0d",
      color: "white",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        backgroundColor: "rgba(26, 26, 26, 0.95)",
        borderRadius: "20px",
        padding: "3rem",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        maxWidth: "500px",
        width: "100%",
        textAlign: "center"
      }}>
        <h1 style={{ color: "#cc00cc", marginBottom: "2rem" }}>🔧 Admin Setup</h1>
        
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc" }}>
            Admin Email:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(26, 26, 26, 0.8)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "1rem",
              marginBottom: "1rem"
            }}
          />
          
          <label style={{ display: "block", marginBottom: "0.5rem", color: "#ccc" }}>
            Admin Password:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(26, 26, 26, 0.8)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "1rem",
              marginBottom: "1rem"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleCreateAdmin}
            disabled={isCreating}
            style={{
              padding: "1rem 2rem",
              backgroundColor: isCreating ? "#666" : "#00aa44",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isCreating ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "bold"
            }}
          >
            {isCreating ? "Creating..." : "🔧 Create Admin User"}
          </button>
          
          <button
            onClick={handleTestLogin}
            disabled={isCreating}
            style={{
              padding: "1rem 2rem",
              backgroundColor: isCreating ? "#666" : "#4285f4",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isCreating ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "bold"
            }}
          >
            {isCreating ? "Testing..." : "🧪 Test Login"}
          </button>
          
          <button
            onClick={handleVerifySetup}
            disabled={isCreating}
            style={{
              padding: "1rem 2rem",
              backgroundColor: isCreating ? "#666" : "#ffaa00",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isCreating ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "bold"
            }}
          >
            {isCreating ? "Verifying..." : "🔍 Verify Setup"}
          </button>
        </div>

        {result && (
          <div style={{
            marginTop: "2rem",
            padding: "1rem",
            borderRadius: "8px",
            backgroundColor: result.success ? "rgba(0, 255, 136, 0.1)" : "rgba(255, 107, 107, 0.1)",
            border: `1px solid ${result.success ? "rgba(0, 255, 136, 0.3)" : "rgba(255, 107, 107, 0.3)"}`,
            color: result.success ? "#00ff88" : "#ff6b6b"
          }}>
            <strong>{result.success ? "✅ Success:" : "❌ Error:"}</strong> {result.message}
          </div>
        )}

        <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "8px" }}>
          <h3 style={{ color: "#cc00cc", marginBottom: "1rem" }}>Instructions:</h3>
          <ol style={{ textAlign: "left", color: "#ccc", lineHeight: "1.6" }}>
            <li>Click "Create Admin User" to set up the admin account</li>
            <li>Click "Test Login" to verify the credentials work</li>
            <li>Once successful, go to <a href="/admin" style={{ color: "#cc00cc" }}>/admin</a> to access the admin portal</li>
            <li>Delete this setup page after successful setup</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default AdminSetupPage;
