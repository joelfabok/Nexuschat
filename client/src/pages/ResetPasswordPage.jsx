import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Reset token missing');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password reset successfully. Please sign in.');
      navigate('/auth');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-surface-700 border border-surface-300 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Reset Password</h2>
        {token ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">New Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input-base" placeholder="At least 8 chars" minLength={8} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="input-base" placeholder="Confirm new password" minLength={8} required />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        ) : (
          <div className="text-sm text-text-muted">Reset token not found. Please use the link sent to your email.</div>
        )}
      </div>
    </div>
  );
}
