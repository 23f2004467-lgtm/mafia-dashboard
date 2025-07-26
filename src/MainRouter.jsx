import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App";
import AdminPortal from "./AdminPortal";

export default function MainRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    </Router>
  );
}
