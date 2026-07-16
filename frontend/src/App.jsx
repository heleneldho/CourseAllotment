import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyPreferences from './pages/FacultyPreferences';
import FacultyViewSchedule from './pages/FacultyViewSchedule';

const ProtectedRoute = ({ children, allowedRole }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("userRole");
  if (!token) return <Navigate to="/" replace />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/admin-dashboard" element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Faculty Split View Portal Layouts */}
        <Route path="/faculty-dashboard" element={
          <ProtectedRoute allowedRole="faculty">
            <FacultyDashboard />
          </ProtectedRoute>
        } />

        <Route path="/faculty-preferences" element={
          <ProtectedRoute allowedRole="faculty">
            <FacultyPreferences />
          </ProtectedRoute>
        } />

        <Route path="/faculty-schedule" element={
          <ProtectedRoute allowedRole="faculty">
            <FacultyViewSchedule />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}