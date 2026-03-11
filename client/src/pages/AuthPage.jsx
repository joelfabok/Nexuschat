import { useState } from 'react';
import { useAuthStore } from '../context/authStore';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const { login, register, isLoading } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = mode === 'login'
      ? await login(form.email, form.password)
      : await register(form.username, form.email, form.password, form.displayName);

    if (!result.success) toast.error(result.error);
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #1a1f3a 0%, #0d0f17 60%)' }}>
      
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4 shadow-lg shadow-brand-600/30">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8h20M6 16h14M6 24h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="26" cy="24" r="4" fill="#818cf8"/>
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">Nexus</h1>
          <p className="text-text-secondary text-sm mt-1">Secure, private, yours.</p>
        </div>

        {/* Card */}
        <div className="bg-surface-700 border border-surface-300 rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-surface-800 p-1 mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                  mode === m ? 'bg-surface-500 text-text-primary shadow' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Username</label>
                  <input className="input-base" type="text" placeholder="cooluser123" value={form.username} onChange={set('username')} required minLength={2} maxLength={32} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Display Name</label>
                  <input className="input-base" type="text" placeholder="Cool User" value={form.displayName} onChange={set('displayName')} maxLength={32} />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
              <input className="input-base" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Password</label>
              <input className="input-base" type="password" placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          End-to-end secure · Self-hosted · No ads
        </p>
      </div>
    </div>
  );
}
