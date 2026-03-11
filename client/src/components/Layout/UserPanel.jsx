import { useState } from 'react';
import { Mic, MicOff, Headphones, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import ProfileModal from '../Modals/ProfileModal';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  online: 'bg-status-online',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-status-offline',
};

export default function UserPanel() {
  const { user, logout } = useAuthStore();
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
  };

  if (!user) return null;

  const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="h-14 px-2 flex items-center gap-2 bg-surface-900 border-t border-surface-300 flex-shrink-0">
        {/* Avatar - clickable to open profile */}
        <button
          onClick={() => setShowProfile(true)}
          className="relative flex-shrink-0 group"
          title="Edit profile"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity group-hover:opacity-80"
            style={{ backgroundColor: user.avatarColor || '#4f46e5' }}
          >
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : initials}
          </div>
          <div className={`status-dot absolute -bottom-0.5 -right-0.5 ${STATUS_COLORS[user.status || 'offline']}`} />
        </button>

        {/* User info - clickable to open profile */}
        <button onClick={() => setShowProfile(true)} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
          <p className="text-sm font-medium text-text-primary truncate leading-tight">{user.displayName || user.username}</p>
          <p className="text-xs text-text-muted truncate leading-tight">
            {user.customStatus ? `💬 ${user.customStatus}` : `#${user.username}`}
          </p>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${muted ? 'text-status-dnd hover:bg-surface-400' : 'text-text-secondary hover:bg-surface-400 hover:text-text-primary'}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button
            onClick={() => setDeafened(!deafened)}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${deafened ? 'text-status-dnd hover:bg-surface-400' : 'text-text-secondary hover:bg-surface-400 hover:text-text-primary'}`}
            title={deafened ? 'Undeafen' : 'Deafen'}
          >
            <Headphones size={15} />
          </button>
          <button
            onClick={() => setShowProfile(true)}
            className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-surface-400 hover:text-text-primary transition-colors"
            title="Edit profile"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={handleLogout}
            className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-surface-400 hover:text-status-dnd transition-colors"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
