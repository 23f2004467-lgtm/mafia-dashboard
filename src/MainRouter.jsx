import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import AdminPortal from "./AdminPortal";
import AdminSetupPage from "./AdminSetupPage";
import DebugPage from "./DebugPage";
import ComponentTest from "./ComponentTest";

export default function MainRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/setup" element={<AdminSetupPage />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/test" element={<ComponentTest />} />
      </Routes>
    </Router>
  );
}
