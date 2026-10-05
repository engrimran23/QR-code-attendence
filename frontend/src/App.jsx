import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { OfflineBanner, InstallPrompt } from "./components/PWAPrompt";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Today from "./pages/Today";
import DailyReport from "./pages/DailyReport";
import MonthlyReport from "./pages/MonthlyReport";
import StudentManagement from "./pages/StudentManagement";
import MarkLeave from "./pages/MarkLeave";
import LowAttendance from "./pages/LowAttendance";
import Notifications from "./pages/Notifications";
import SuperAdmin from "./pages/SuperAdmin";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontSize:14,color:"#9CA3AF" }}>Loading…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/"               element={<PrivateRoute><Today /></PrivateRoute>} />
      <Route path="/daily"          element={<PrivateRoute><DailyReport /></PrivateRoute>} />
      <Route path="/monthly"        element={<PrivateRoute><MonthlyReport /></PrivateRoute>} />
      <Route path="/students"       element={<PrivateRoute><StudentManagement /></PrivateRoute>} />
      <Route path="/mark-leave"     element={<PrivateRoute><MarkLeave /></PrivateRoute>} />
      <Route path="/low-attendance" element={<PrivateRoute><LowAttendance /></PrivateRoute>} />
      <Route path="/notifications"  element={<PrivateRoute><Notifications /></PrivateRoute>} />
      <Route path="/super-admin"    element={<PrivateRoute><SuperAdmin /></PrivateRoute>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/app">
        <OfflineBanner />
        <InstallPrompt />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
