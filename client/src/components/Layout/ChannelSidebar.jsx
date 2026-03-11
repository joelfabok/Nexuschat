import { useState, useEffect } from 'react';
import { Hash, Volume2, Plus, ChevronDown, Settings, Trash2, Edit2, Lock, Unlock, Mic, Monitor, Megaphone, Calendar, BarChart2 } from 'lucide-react';
import EventsPanel from '../Events/EventsPanel';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import { useUnreadStore } from '../../context/unreadStore';
import { useProfile } from '../../context/ProfileContext';
import { getSocket } from '../../utils/socket';
import ServerSettingsModal from '../Modals/ServerSettingsModal';
import toast from 'react-hot-toast';

const CHANNEL_TYPE_ICON = {
  text: Hash,
  voice: Volume2,
  announcement: Megaphone,
};

export default function ChannelSidebar({ server, activeChannel, onChannelSelect, onServerUpdate, onServerDelete }) {
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  const [showSettings, setShowSettings] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [voiceMembers, setVoiceMembers] = useState({});
  const { openProfile } = useProfile() || {}; // channelId -> [member]
  const { user } = useAuthStore();
  const { getChannelUnread } = useUnreadStore();

  if (!server) return null;

  const textChannels = server.channels?.filter(c => c.type === 'text' || c.type === 'announcement') || [];
  const voiceChannels = server.channels?.filter(c => c.type === 'voice') || [];
  const myRole = server.members?.find(m => (m.user?._id || m.user) === user._id)?.role;
  const canManage = ['owner', 'admin'].includes(myRole);
  const isStaff = ['owner', 'admin', 'moderator'].includes(myRole);

  // Listen for voice member list updates from server
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onVoiceMembers = ({ channelId, members }) => {
      setVoiceMembers(prev => ({ ...prev, [channelId]: members }));
    };
    const onChannelUpdated = ({ channelId, locked }) => {
      onServerUpdate({
        ...server,
        channels: server.channels.map(c => c._id === channelId ? { ...c, locked } : c),
      });
    };
    socket.on('voice:channel-members', onVoiceMembers);
    socket.on('channel:updated', onChannelUpdated);
    return () => {
      socket.off('voice:channel-members', onVoiceMembers);
      socket.off('channel:updated', onChannelUpdated);
    };
  }, [server]);

  const createChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const { data } = await api.post('/channels', {
        serverId: server._id,
        name: newChannelName.trim(),
        type: newChannelType,
      });
      onServerUpdate({ ...server, channels: [...(server.channels || []), data] });
      setNewChannelName('');
      setShowAddChannel(false);
      toast.success(`Channel created`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create channel');
    }
  };

  const startEditChannel = (ch, e) => {
    e.stopPropagation();
    setEditingChannel(ch._id);
    setEditChannelName(ch.name);
  };

  const saveChannelName = async (channelId) => {
    if (!editChannelName.trim()) { setEditingChannel(null); return; }
    try {
      const { data } = await api.patch(`/channels/${channelId}`, { name: editChannelName.trim() });
      onServerUpdate({ ...server, channels: server.channels.map(c => c._id === channelId ? { ...c, ...data } : c) });
    } catch (err) {
      toast.error('Failed to rename');
    } finally { setEditingChannel(null); }
  };

  const deleteChannel = async (channelId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this channel? All messages will be lost.')) return;
    try {
      await api.delete(`/channels/${channelId}`);
      onServerUpdate({ ...server, channels: server.channels.filter(c => c._id !== channelId) });
      toast.success('Channel deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const toggleLock = async (ch, e) => {
    e.stopPropagation();
    const socket = getSocket();
    const newLocked = !ch.locked;
    socket?.emit('channel:lock', { channelId: ch._id, locked: newLocked });
    // Optimistic update
    onServerUpdate({ ...server, channels: server.channels.map(c => c._id === ch._id ? { ...c, locked: newLocked } : c) });
    toast.success(newLocked ? `#${ch.name} locked` : `#${ch.name} unlocked`);
  };

  const renderChannelRow = (ch) => {
    const Icon = CHANNEL_TYPE_ICON[ch.type] || Hash;
    const members = voiceMembers[ch._id] || [];
    const isVoice = ch.type === 'voice';
    const unread = getChannelUnread(ch._id);

    return (
      <div key={ch._id} className="group/ch">
        {editingChannel === ch._id ? (
          <form onSubmit={e => { e.preventDefault(); saveChannelName(ch._id); }} className="px-1">
            <input
              autoFocus
              className="input-base text-sm py-1 w-full"
              value={editChannelName}
              onChange={e => setEditChannelName(e.target.value)}
              onBlur={() => saveChannelName(ch._id)}
              onKeyDown={e => e.key === 'Escape' && setEditingChannel(null)}
            />
          </form>
        ) : (
          <>
            <button
              onClick={() => onChannelSelect(ch)}
              className={`channel-item w-full ${activeChannel?._id === ch._id ? 'active' : ''} ${ch.locked ? 'opacity-75' : ''}`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className={`truncate flex-1 text-left ${unread > 0 && activeChannel?._id !== ch._id ? 'font-semibold text-text-primary' : ''}`}>{ch.name}</span>

              {/* Unread badge */}
              {unread > 0 && activeChannel?._id !== ch._id && (
                <span className="ml-auto flex-shrink-0 bg-brand-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}

              {/* Lock badge */}
              {ch.locked && unread === 0 && <Lock size={11} className="text-status-dnd flex-shrink-0 mr-1" />}

              {/* Voice member count */}
              {isVoice && members.length > 0 && (
                <span className="text-xs text-text-muted flex-shrink-0 ml-auto mr-1">{members.length}</span>
              )}

              {/* Admin controls on hover */}
              {canManage && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/ch:opacity-100 transition-opacity ml-auto">
                  {!isVoice && isStaff && (
                    <span
                      onClick={e => toggleLock(ch, e)}
                      className={`p-0.5 rounded transition-colors ${ch.locked ? 'text-status-dnd hover:text-red-400' : 'hover:text-text-primary'}`}
                      title={ch.locked ? 'Unlock channel' : 'Lock channel'}
                    >
                      {ch.locked ? <Lock size={11} /> : <Unlock size={11} />}
                    </span>
                  )}
                  <span onClick={e => startEditChannel(ch, e)} className="hover:text-text-primary p-0.5 rounded" title="Rename">
                    <Edit2 size={11} />
                  </span>
                  <span onClick={e => deleteChannel(ch._id, e)} className="hover:text-status-dnd p-0.5 rounded" title="Delete">
                    <Trash2 size={11} />
                  </span>
                </div>
              )}
            </button>

            {/* Voice member list under the channel */}
            {isVoice && members.length > 0 && (
              <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                {members.map(m => (
                  <div key={m.userId} className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                    onClick={() => openProfile?.(m.userId)}>
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: m.avatarColor || '#4f46e5' }}
                    >
                      {(m.displayName || m.username || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate flex-1">{m.displayName || m.username}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {m.muted && <MicOff size={9} className="text-status-dnd" />}
                      {m.screenSharing && <Monitor size={9} className="text-brand-400" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Server header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-surface-300 shadow-sm flex-shrink-0 group">
          <h2 className="font-display font-bold text-text-primary truncate text-sm flex-1">{server.name}</h2>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setShowEvents(p => !p)} title="Events"
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${showEvents ? 'text-brand-400 bg-brand-500/10' : 'text-text-muted hover:text-text-primary'}`}>
              <Calendar size={14} />
            </button>
            {canManage && (
              <button onClick={() => setShowAnalytics(p => !p)} title="Analytics"
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${showAnalytics ? 'text-brand-400 bg-brand-500/10' : 'text-text-muted hover:text-text-primary'}`}>
                <BarChart2 size={14} />
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowSettings(true)} title="Settings"
                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded">
                <Settings size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Events or Analytics panel (replaces channel list when open) */}
        {showEvents && (
          <div className="flex-1 overflow-hidden border-b border-surface-300">
            <EventsPanel server={server} onClose={() => setShowEvents(false)} />
          </div>
        )}
        {showAnalytics && !showEvents && (
          <div className="flex-1 overflow-y-auto border-b border-surface-300 scrollbar-hide">
            <AnalyticsDashboard server={server} />
          </div>
        )}

        {/* Channels */}
        {!showEvents && !showAnalytics && (
        <div className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
          <ChannelGroup label="Text Channels" canManage={canManage}
            onAdd={() => { setNewChannelType('text'); setShowAddChannel(true); }}>
            {textChannels.map(renderChannelRow)}
          </ChannelGroup>

          <ChannelGroup label="Voice Channels" canManage={canManage} className="mt-3"
            onAdd={() => { setNewChannelType('voice'); setShowAddChannel(true); }}>
            {voiceChannels.map(renderChannelRow)}
          </ChannelGroup>

          {showAddChannel && (
            <div className="mt-3 space-y-2 px-1">
              <div className="flex gap-1">
                {['text', 'voice', 'announcement'].map(t => (
                  <button key={t} onClick={() => setNewChannelType(t)}
                    className={`flex-1 text-xs py-1 rounded transition-colors capitalize ${newChannelType === t ? 'bg-brand-600 text-white' : 'bg-surface-500 text-text-muted hover:text-text-secondary'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <form onSubmit={createChannel}>
                <input autoFocus className="input-base text-sm py-1.5"
                  placeholder={newChannelType === 'voice' ? 'Voice Channel' : newChannelType === 'announcement' ? 'announcements' : 'new-channel'}
                  value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                  onBlur={() => { if (!newChannelName) setShowAddChannel(false); }}
                  onKeyDown={e => e.key === 'Escape' && setShowAddChannel(false)} />
              </form>
            </div>
          )}
        </div>
        )}
      </div>

      {showSettings && (
        <ServerSettingsModal server={server} onClose={() => setShowSettings(false)} onUpdate={onServerUpdate} onDelete={onServerDelete} />
      )}
    </>
  );
}

function MicOff({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function ChannelGroup({ label, onAdd, children, className = '', canManage }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={className}>
      <div className="flex items-center justify-between px-1 mb-1 group">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-secondary uppercase tracking-wider transition-colors"
        >
          <ChevronDown size={12} className={`transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
          {label}
        </button>
        {canManage && (
          <button onClick={onAdd} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all">
            <Plus size={14} />
          </button>
        )}
      </div>
      {!collapsed && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
