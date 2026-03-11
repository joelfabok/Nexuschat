import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function InvitePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [serverInfo, setServerInfo] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Preview the server before joining
    api.get(`/servers/preview/${code}`)
      .then(({ data }) => setServerInfo(data))
      .catch(() => setError('This invite link is invalid or has expired.'));
  }, [code]);

  const join = async () => {
    if (!user) {
      // Save invite code and redirect to auth
      sessionStorage.setItem('pendingInvite', code);
      navigate('/auth');
      return;
    }
    setJoining(true);
    try {
      await api.post(`/servers/join/${code}`);
      toast.success(`Joined ${serverInfo?.name}!`);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1a1f3a 0%, #0d0f17 60%)' }}>
      <div className="bg-surface-700 border border-surface-300 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <path d="M6 8h20M6 16h14M6 24h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="26" cy="24" r="4" fill="#818cf8"/>
          </svg>
        </div>

        {error ? (
          <>
            <h2 className="text-xl font-display font-bold text-text-primary mb-2">Invalid Invite</h2>
            <p className="text-text-secondary text-sm mb-6">{error}</p>
            <button onClick={() => navigate(user ? '/app' : '/auth')} className="btn-primary px-6 py-2">
              {user ? 'Go to App' : 'Sign In'}
            </button>
          </>
        ) : serverInfo ? (
          <>
            <p className="text-text-muted text-sm mb-2">You've been invited to join</p>
            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-xl font-bold text-white mx-auto mb-3">
              {serverInfo.name.slice(0, 2).toUpperCase()}
            </div>
            <h2 className="text-2xl font-display font-bold text-text-primary mb-1">{serverInfo.name}</h2>
            {serverInfo.description && (
              <p className="text-text-secondary text-sm mb-2">{serverInfo.description}</p>
            )}
            <p className="text-text-muted text-xs mb-6">{serverInfo.memberCount} member{serverInfo.memberCount !== 1 ? 's' : ''}</p>

            {!user && (
              <p className="text-text-secondary text-sm mb-4">You need to be signed in to join.</p>
            )}

            <button onClick={join} disabled={joining} className="btn-primary w-full py-3 text-base disabled:opacity-50">
              {joining ? 'Joining…' : user ? `Join ${serverInfo.name}` : 'Sign In to Join'}
            </button>

            {user && (
              <button onClick={() => navigate('/app')} className="btn-ghost w-full mt-2 text-sm">
                Maybe later
              </button>
            )}
          </>
        ) : (
          <div className="py-4">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-muted text-sm">Loading invite…</p>
          </div>
        )}
      </div>
    </div>
  );
}
