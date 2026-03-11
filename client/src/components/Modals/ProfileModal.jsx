import { useState, useEffect, useRef } from 'react';
import { X, Check, Eye, EyeOff, Mic, Volume2, Play, Square, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: 'bg-status-online' },
  { value: 'idle', label: 'Idle', color: 'bg-status-idle' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'bg-status-dnd' },
  { value: 'offline', label: 'Invisible', color: 'bg-status-offline' },
];

const AVATAR_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#0284c7',
  '#6d28d9', '#be185d', '#b45309', '#065f46',
];

import BillingTab from '../Payments/BillingTab';
import DMPrivacySettings from '../Friends/DMPrivacySettings';

const TABS = ['Profile', 'Audio', 'Privacy', 'Billing', 'Security'];

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState('Profile');

  // Profile fields
  const [displayName, setDisplayName] = useState(user.displayName || user.username);
  const [customStatus, setCustomStatus] = useState(user.customStatus || '');
  const [status, setStatus] = useState(user.status || 'online');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || '#4f46e5');
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [bannerColor, setBannerColor] = useState(user.bannerColor || '#1e1b4b');
  const [location, setLocation] = useState(user.location || '');
  const [website, setWebsite] = useState(user.website || '');
  const [statusPost, setStatusPost] = useState(user.statusPost || '');
  const [twitter, setTwitter] = useState(user.socialLinks?.twitter || '');
  const [github, setGithub] = useState(user.socialLinks?.github || '');
  const [instagram, setInstagram] = useState(user.socialLinks?.instagram || '');

  // Security fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const initials = (displayName || user.username || '?').slice(0, 2).toUpperCase();

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', { displayName, customStatus, avatarColor, status, bio, bannerColor, location, website, statusPost, socialLinks: { twitter, github, instagram } });
      updateUser(data);
      const { getSocket } = await import('../../utils/socket');
      getSocket()?.emit('status:update', { status });
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return toast.error('Fill in all fields');
    if (newPassword.length < 8) return toast.error('New password must be 8+ characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-surface-700 border border-surface-300 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
          <h2 className="font-display font-bold text-text-primary">Settings</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-300 px-6 flex-shrink-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-brand-500 text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'Profile' && (
            <div className="space-y-5">
              {/* Preview */}
              <div className="flex items-center gap-4 p-4 bg-surface-600 rounded-xl border border-surface-300">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: avatarColor }}>{initials}</div>
                <div>
                  <p className="font-semibold text-text-primary">{displayName || user.username}</p>
                  <p className="text-sm text-text-muted">{user.username}{user.userTag ? `#${user.userTag}` : ''}</p>
                  {customStatus && <p className="text-xs text-text-secondary mt-0.5">💬 {customStatus}</p>}
                </div>
              </div>

              {/* Avatar color */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Avatar Color</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button key={color} onClick={() => setAvatarColor(color)}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: color }}>
                      {avatarColor === color && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Display Name</label>
                <input className="input-base" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={32} placeholder={user.username} />
                <p className="text-xs text-text-muted mt-1">Username stays as <strong>#{user.username}</strong></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Custom Status</label>
                <input className="input-base" value={customStatus} onChange={e => setCustomStatus(e.target.value)} maxLength={128} placeholder="What are you up to?" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setStatus(s.value)}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border text-sm transition-all ${
                        status === s.value ? 'border-brand-500 bg-brand-500/10' : 'border-surface-300 hover:border-surface-200 bg-surface-600'
                      }`}>
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.color}`} />
                      <span className="text-text-primary">{s.label}</span>
                      {status === s.value && <Check size={14} className="text-brand-400 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Post */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Status Post <span className="text-text-muted">({statusPost.length}/280)</span></label>
                <textarea value={statusPost} onChange={e => setStatusPost(e.target.value)} maxLength={280} rows={2}
                  placeholder="What's on your mind?"
                  className="w-full bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm resize-none focus:outline-none focus:border-brand-500 placeholder-text-muted" />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Bio <span className="text-text-muted">({bio.length}/300)</span></label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3}
                  placeholder="Tell people about yourself..."
                  className="w-full bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm resize-none focus:outline-none focus:border-brand-500 placeholder-text-muted" />
              </div>

              {/* Location & Website */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                  <input value={location} onChange={e => setLocation(e.target.value)} maxLength={64} placeholder="City, Country"
                    className="w-full bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-500 placeholder-text-muted" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Website</label>
                  <input value={website} onChange={e => setWebsite(e.target.value)} maxLength={128} placeholder="https://..."
                    className="w-full bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-500 placeholder-text-muted" />
                </div>
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Social Links</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><span className="text-sky-400 text-xs w-16 shrink-0">Twitter</span>
                    <input value={twitter} onChange={e => setTwitter(e.target.value)} maxLength={64} placeholder="@username"
                      className="flex-1 bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-500 placeholder-text-muted" /></div>
                  <div className="flex items-center gap-2"><span className="text-gray-400 text-xs w-16 shrink-0">GitHub</span>
                    <input value={github} onChange={e => setGithub(e.target.value)} maxLength={64} placeholder="username"
                      className="flex-1 bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-500 placeholder-text-muted" /></div>
                  <div className="flex items-center gap-2"><span className="text-pink-400 text-xs w-16 shrink-0">Instagram</span>
                    <input value={instagram} onChange={e => setInstagram(e.target.value)} maxLength={64} placeholder="@username"
                      className="flex-1 bg-surface-600 border border-surface-300 rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-brand-500 placeholder-text-muted" /></div>
                </div>
              </div>

              <button onClick={saveProfile} disabled={saving} className="btn-primary w-full py-2.5 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          )}

          {tab === 'Audio' && <AudioSettings />}
          {tab === 'Privacy' && <div className="p-4"><DMPrivacySettings /></div>}
          {tab === 'Billing' && <BillingTab />}

          {tab === 'Security' && (
            <div className="space-y-5">
              <div className="p-4 bg-surface-600 rounded-xl border border-surface-300 text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-1">{user.email}</p>
                <p>Username: <span className="text-text-primary font-mono">#{user.username}</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Current Password</label>
                <div className="relative">
                  <input className="input-base pr-10" type={showPasswords ? 'text' : 'password'}
                    value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    onClick={() => setShowPasswords(!showPasswords)}>
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">New Password</label>
                <input className="input-base" type={showPasswords ? 'text' : 'password'}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Confirm New Password</label>
                <input className="input-base" type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>

              <button onClick={changePassword} disabled={saving || !currentPassword || !newPassword}
                className="btn-primary w-full py-2.5 disabled:opacity-50">
                {saving ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Audio Settings Tab ─────────────────────────────────────────────────────────
function AudioSettings() {
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMic, setSelectedMic] = useState('default');
  const [selectedSpeaker, setSelectedSpeaker] = useState('default');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGain, setAutoGain] = useState(true);
  const [testing, setTesting] = useState(false); // 'mic' | 'speaker' | false
  const [micLevel, setMicLevel] = useState(0);
  const [hearingMic, setHearingMic] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);       // input gain node (controls input volume)
  const loopbackNodeRef = useRef(null);   // connects mic → speakers for hearing yourself
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Load available devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMicrophones(devices.filter(d => d.kind === 'audioinput'));
        setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
      } catch {
        setPermissionDenied(true);
      }
    };
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      stopAllTests();
    };
  }, []);

  // Load saved settings on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nexus_audio_settings') || '{}');
      if (saved.selectedMic) setSelectedMic(saved.selectedMic);
      if (saved.selectedSpeaker) setSelectedSpeaker(saved.selectedSpeaker);
      if (saved.inputVolume !== undefined) setInputVolume(saved.inputVolume);
      if (saved.outputVolume !== undefined) setOutputVolume(saved.outputVolume);
      if (saved.noiseSuppression !== undefined) setNoiseSuppression(saved.noiseSuppression);
      if (saved.echoCancellation !== undefined) setEchoCancellation(saved.echoCancellation);
      if (saved.autoGain !== undefined) setAutoGain(saved.autoGain);
    } catch {}
  }, []);

  // Live-update the gain node when input volume slider changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = inputVolume / 100;
    }
  }, [inputVolume]);

  const stopAllTests = () => {
    cancelAnimationFrame(animFrameRef.current);
    // Disconnect loopback
    if (loopbackNodeRef.current) {
      try { loopbackNodeRef.current.disconnect(); } catch (_) {}
      loopbackNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    gainNodeRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setMicLevel(0);
    setTesting(false);
    setHearingMic(false);
  };

  const startMicTest = async () => {
    if (testing === 'mic') { stopAllTests(); return; }
    stopAllTests();
    try {
      const constraints = {
        audio: {
          deviceId: selectedMic !== 'default' ? { exact: selectedMic } : undefined,
          noiseSuppression,
          echoCancellation: false, // turn off for mic test so you can hear yourself cleanly
          autoGainControl: autoGain,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // Gain node — controlled by the input volume slider
      const gainNode = ctx.createGain();
      gainNode.gain.value = inputVolume / 100;
      gainNodeRef.current = gainNode;

      // Analyser for the level meter
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Signal chain: source → gain → analyser
      source.connect(gainNode);
      gainNode.connect(analyser);
      // Note: NOT connected to destination yet — loopback is separate toggle

      setTesting('mic');

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, avg * 2.5 * (inputVolume / 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      toast.error('Could not access microphone');
    }
  };

  const toggleLoopback = () => {
    const ctx = audioCtxRef.current;
    const gainNode = gainNodeRef.current;
    if (!ctx || !gainNode) {
      toast.error('Start mic test first');
      return;
    }

    if (hearingMic) {
      // Disconnect loopback
      try { gainNode.disconnect(ctx.destination); } catch (_) {}
      loopbackNodeRef.current = null;
      setHearingMic(false);
      toast('Loopback off — you can no longer hear yourself', { icon: '🔇' });
    } else {
      // Connect gain → destination so mic audio plays through speakers
      gainNode.connect(ctx.destination);
      loopbackNodeRef.current = gainNode;
      setHearingMic(true);
      toast('Loopback on — speak to hear yourself', { icon: '🎧' });
    }
  };

  const testSpeaker = () => {
    if (testing === 'speaker') { stopAllTests(); return; }
    stopAllTests();
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0.3 * (outputVolume / 100), ctx.currentTime);
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.25);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.75);
    setTesting('speaker');
    oscillator.onended = () => { ctx.close(); setTesting(false); };
  };

  const saveAudioSettings = () => {
    const settings = { selectedMic, selectedSpeaker, inputVolume, outputVolume, noiseSuppression, echoCancellation, autoGain };
    localStorage.setItem('nexus_audio_settings', JSON.stringify(settings));
    toast.success('Audio settings saved!');
  };

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <AlertCircle size={36} className="text-status-dnd" />
        <p className="font-semibold text-text-primary">Microphone Access Denied</p>
        <p className="text-sm text-text-secondary max-w-xs">Allow microphone access in your browser settings to configure audio devices and test your mic.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Microphone */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
          <Mic size={12} /> Microphone
        </label>
        <select className="input-base text-sm" value={selectedMic} onChange={e => setSelectedMic(e.target.value)}>
          <option value="default">Default Microphone</option>
          {microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 8)})`}</option>)}
        </select>

        {/* Input volume — live updates gain node if test is running */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-text-secondary">Input Volume</span>
            <span className="text-xs font-mono text-text-muted">{inputVolume}%</span>
          </div>
          <input type="range" min="0" max="200" value={inputVolume}
            onChange={e => setInputVolume(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-400 accent-brand-500" />
          <p className="text-xs text-text-muted mt-1">
            {inputVolume < 80 ? 'Quiet' : inputVolume <= 120 ? 'Normal' : inputVolume <= 160 ? 'Loud' : '⚠️ Very loud — may distort'}
          </p>
        </div>

        {/* Level meter */}
        {testing === 'mic' && (
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-text-secondary">Input Level</span>
              <span className="text-xs font-mono text-text-muted">{Math.round(micLevel)}%</span>
            </div>
            <div className="h-3 bg-surface-400 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${micLevel}%`,
                  backgroundColor: micLevel > 85 ? '#ef4444' : micLevel > 60 ? '#f59e0b' : '#22c55e',
                }} />
            </div>
          </div>
        )}

        {/* Test controls */}
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={startMicTest}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all ${
              testing === 'mic'
                ? 'bg-status-dnd/20 border-status-dnd text-status-dnd'
                : 'bg-surface-600 border-surface-300 text-text-secondary hover:text-text-primary hover:border-brand-500'
            }`}>
            {testing === 'mic' ? <Square size={14} /> : <Play size={14} />}
            {testing === 'mic' ? 'Stop Test' : 'Test Mic'}
          </button>

          {/* Loopback — only available while testing */}
          <button
            onClick={toggleLoopback}
            disabled={testing !== 'mic'}
            title={testing !== 'mic' ? 'Start mic test first' : hearingMic ? 'Click to stop hearing yourself' : 'Click to hear yourself'}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              hearingMic
                ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                : 'bg-surface-600 border-surface-300 text-text-secondary hover:text-text-primary hover:border-brand-500'
            }`}>
            <Volume2 size={14} />
            {hearingMic ? 'Hearing yourself ✓' : 'Hear yourself'}
          </button>
        </div>
        {hearingMic && (
          <p className="text-xs text-brand-400 mt-1.5 flex items-center gap-1">
            🎧 Loopback active — your mic is playing through your speakers
          </p>
        )}
      </div>

      {/* Speaker */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 size={12} /> Speaker / Headphones
        </label>
        <select className="input-base text-sm" value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}>
          <option value="default">Default Speaker</option>
          {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker (${d.deviceId.slice(0, 8)})`}</option>)}
        </select>

        <div className="mt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-text-secondary">Output Volume</span>
            <span className="text-xs font-mono text-text-muted">{outputVolume}%</span>
          </div>
          <input type="range" min="0" max="100" value={outputVolume}
            onChange={e => setOutputVolume(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-400 accent-brand-500" />
        </div>

        <button onClick={testSpeaker}
          className={`mt-3 flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-all ${
            testing === 'speaker'
              ? 'bg-brand-500/20 border-brand-500 text-brand-400'
              : 'bg-surface-600 border-surface-300 text-text-secondary hover:text-text-primary hover:border-brand-500'
          }`}>
          <Play size={14} /> Play Test Tone
        </button>
      </div>

      {/* Voice processing toggles */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Voice Processing</label>
        <div className="space-y-2">
          {[
            { label: 'Noise Suppression', desc: 'Reduces background noise', value: noiseSuppression, set: setNoiseSuppression },
            { label: 'Echo Cancellation', desc: 'Prevents audio feedback', value: echoCancellation, set: setEchoCancellation },
            { label: 'Auto Gain Control', desc: 'Automatically adjusts mic level', value: autoGain, set: setAutoGain },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-center justify-between p-3 bg-surface-600 rounded-xl border border-surface-300">
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
              <button onClick={() => set(!value)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-brand-500' : 'bg-surface-400'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={saveAudioSettings} className="btn-primary w-full py-2.5">
        Save Audio Settings
      </button>
    </div>
  );
}
