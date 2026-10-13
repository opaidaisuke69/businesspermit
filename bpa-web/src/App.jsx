import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Applications from './pages/Applications'
import Payments from './pages/Payments'
import Permits from './pages/Permits'
import VendorMap from './pages/VendorMap'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import Fees from './pages/Fees'
import Signatories from './pages/Signatories'

function ProtectedRoute({ children }) {
  const { admin } = useAuth()
  return admin ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { admin } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={admin ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="users"        element={<Users />} />
        <Route path="applications" element={<Applications />} />
        <Route path="payments"     element={<Payments />} />
        <Route path="permits"      element={<Permits />} />
        <Route path="locations"    element={<VendorMap />} />
        <Route path="reports"      element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="fees"          element={<Fees />} />
        <Route path="signatories"   element={<Signatories />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/bpa-web">
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </BrowserRouter>
    </AuthProvider>
  )
}
