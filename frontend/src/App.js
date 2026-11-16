import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { PayablesPage } from './pages/PayablesPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { ProposalEditorPage } from './pages/ProposalEditorPage';
import { LedgerPage } from './pages/LedgerPage';
// import { SettingsPage } from './pages/SettingsPage';
import { Loader2 } from 'lucide-react';
import './App.css';

// Protected Route Component with onboarding check
function ProtectedRoute({ children, skipOnboardingCheck = false }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if needed (except for onboarding page itself)
  if (needsOnboarding && !skipOnboardingCheck && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

// Public Route Component (redirect to dashboard if logged in)
function PublicRoute({ children }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect to onboarding if needed, otherwise dashboard
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receivables"
        element={
          <ProtectedRoute>
            <ReceivablesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payables"
        element={
          <ProtectedRoute>
            <PayablesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals"
        element={
          <ProtectedRoute>
            <ProposalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/new"
        element={
          <ProtectedRoute>
            <ProposalEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:proposalId/edit"
        element={
          <ProtectedRoute>
            <ProposalEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ledger"
        element={
          <ProtectedRoute>
            <LedgerPage />
          </ProtectedRoute>
        }
      />
      {/* <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      /> */}

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
