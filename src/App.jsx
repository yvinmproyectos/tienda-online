import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useInventoryStore } from './store/inventoryStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SuppliersPage from './pages/SuppliersPage';
import ReportsPage from './pages/ReportsPage';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import SettingsPage from './pages/SettingsPage';
import DiscountsPage from './pages/DiscountsPage';
import UsersPage from './pages/UsersPage';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/pos" replace />;
  }

  return children;
}

// App Routes Component
function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={currentUser ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <DashboardPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/pos" element={
        <ProtectedRoute>
          <Layout>
            <POSPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <InventoryPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <SuppliersPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/discounts" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <DiscountsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <ReportsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <SettingsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <UsersPage />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Redirect to POS by default */}
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}

function App() {
  const { init, isLoading } = useInventoryStore();

  useEffect(() => {
    init();
  }, [init]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">Cargando Sistema...</p>
      </div>
    );
  }

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
