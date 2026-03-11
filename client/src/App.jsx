import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './context/authStore';
import { connectSocket, disconnectSocket } from './utils/socket';
import api from './utils/api';
import AuthPage from './pages/AuthPage';
import AppLayout from './pages/AppLayout';
import InvitePage from './pages/InvitePage';

function ProtectedRoute({ children }) {
  const { user } = useAuthStore();
  return user ? children : <Navigate to="/auth" replace />;
}

function App() {
  const { user, accessToken, refreshToken, setTokens, logout } = useAuthStore();
  // Block rendering AppLayout until we've refreshed the token
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (user && refreshToken) {
        try {
          // Always refresh on mount — stored accessToken may be expired (15min lifetime)
          const { data } = await api.post('/auth/refresh', { refreshToken });
          setTokens(data.accessToken, data.refreshToken);
          connectSocket(data.accessToken);
        } catch (err) {
          // Refresh token expired or invalid — clear session
          await logout();
        }
      }
      // If no user at all, nothing to do — just mark ready
      setAuthReady(true);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After initial auth, reconnect socket if user logs in (e.g. after logging out then back in)
  useEffect(() => {
    if (!authReady) return;
    if (user && accessToken) {
      connectSocket(accessToken);
    } else if (!user) {
      disconnectSocket();
    }
  }, [user?._id, authReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show nothing while we're refreshing — prevents AppLayout from firing API calls with stale token
  if (!authReady) {
    return (
      <div className="w-screen h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e2235',
            color: '#e8eaf6',
            border: '1px solid #3d4266',
            borderRadius: '10px',
            fontFamily: 'DM Sans, sans-serif',
          },
        }}
      />
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/app" replace /> : <AuthPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? '/app' : '/auth'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
