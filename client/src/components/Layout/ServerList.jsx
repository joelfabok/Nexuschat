import { useState } from 'react';
import { MessageSquare, Plus, Compass, Users } from 'lucide-react';
import api from '../../utils/api';
import { useUnreadStore } from '../../context/unreadStore';
import toast from 'react-hot-toast';

function ServerIcon({ server, isActive, onClick }) {
  const initials = server.name.slice(0, 2).toUpperCase();
  return (
    <div className="relative group flex justify-center mb-1" onClick={onClick}>
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-text-primary transition-all duration-150 ${isActive ? 'h-8' : 'h-0 group-hover:h-4'}`} />
      <button
        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-150 ${
          isActive ? 'rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'bg-surface-700 text-text-secondary hover:bg-brand-600 hover:text-white hover:rounded-xl'
        }`}
        title={server.name}
      >
        {server.icon ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-inherit" /> : initials}
      </button>
      <div className="absolute left-16 bg-surface-900 text-text-primary text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-surface-300 shadow-xl font-medium">
        {server.name}
      </div>
    </div>
  );
}

export default function ServerList({ servers, activeServer, onServerSelect, onDMView, onFriendsView, onServerCreated, isDMView, isFriendsView }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { totalDMUnread } = useUnreadStore();
  const totalDMs = totalDMUnread();

  const createServer = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/servers', { name: serverName.trim() });
      onServerCreated(data);
      setShowCreateModal(false);
      setServerName('');
      toast.success(`"${data.name}" created!`);
    } catch (err) {
      toast.error('Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  const joinServer = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    const raw = inviteCode.trim();
    const code = raw.includes('/') ? raw.split('/').filter(Boolean).pop() : raw;
    try {
      const { data } = await api.post(`/servers/join/${code}`);
      onServerCreated(data);
      setShowJoinModal(false);
      setInviteCode('');
      toast.success(`Joined "${data.name}"!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-[72px] flex-shrink-0 flex flex-col items-center py-3 gap-1 bg-surface-900 border-r border-surface-300">
        {/* DMs button */}
        <div className="relative group flex justify-center mb-1">
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-text-primary transition-all duration-150 ${isDMView ? 'h-8' : 'h-0 group-hover:h-4'}`} />
          <button
            onClick={onDMView}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150 relative ${
              isDMView ? 'rounded-xl bg-brand-600 text-white' : 'bg-surface-700 text-text-secondary hover:bg-brand-600 hover:text-white hover:rounded-xl'
            }`}
            title="Direct Messages"
          >
            <MessageSquare size={22} />
            {totalDMs > 0 && !isDMView && (
              <span className="absolute -top-1 -right-1 bg-status-dnd text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-surface-900">
                {totalDMs > 99 ? '99+' : totalDMs}
              </span>
            )}
          </button>
        </div>

        {/* Friends button */}
        <div className="relative group flex justify-center mb-1">
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-text-primary transition-all duration-150 ${isFriendsView ? 'h-8' : 'h-0 group-hover:h-4'}`} />
          <button
            onClick={onFriendsView}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-150 relative ${
              isFriendsView ? 'rounded-xl bg-brand-600 text-white' : 'bg-surface-700 text-text-secondary hover:bg-brand-600 hover:text-white hover:rounded-xl'
            }`}
            title="Friends"
          >
            <Users size={22} />
          </button>
        </div>

        <div className="w-8 h-px bg-surface-300 my-1" />

        {/* Servers */}
        <div className="flex flex-col items-center gap-1 overflow-y-auto flex-1 w-full px-3 pb-2 scrollbar-hide">
          {(Array.isArray(servers) ? servers : []).map(server => (
            <ServerIcon key={server._id} server={server} isActive={activeServer?._id === server._id} onClick={() => onServerSelect(server)} />
          ))}
        </div>

        <div className="w-8 h-px bg-surface-300 mb-1" />

        <button onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 rounded-2xl bg-surface-700 text-status-online hover:bg-status-online hover:text-white hover:rounded-xl flex items-center justify-center transition-all duration-150 mb-1"
          title="Create server">
          <Plus size={22} />
        </button>
        <button onClick={() => setShowJoinModal(true)}
          className="w-12 h-12 rounded-2xl bg-surface-700 text-text-secondary hover:bg-brand-600 hover:text-white hover:rounded-xl flex items-center justify-center transition-all duration-150"
          title="Join server">
          <Compass size={22} />
        </button>
      </div>

      {showCreateModal && (
        <Modal title="Create a Server" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={createServer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Server Name</label>
              <input className="input-base" autoFocus placeholder="My Awesome Server" value={serverName} onChange={e => setServerName(e.target.value)} maxLength={100} />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={loading || !serverName.trim()} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showJoinModal && (
        <Modal title="Join a Server" onClose={() => setShowJoinModal(false)}>
          <form onSubmit={joinServer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Invite Link or Code</label>
              <input className="input-base" autoFocus placeholder="https://…/invite/abc1234  or just  abc1234" value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
              <p className="text-xs text-text-muted mt-1.5">Paste a full invite link or just the short code.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowJoinModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={loading || !inviteCode.trim()} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-surface-700 border border-surface-300 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-display font-bold text-text-primary mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
