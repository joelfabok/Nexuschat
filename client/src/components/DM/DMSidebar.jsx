import { useState, useEffect } from 'react';
import { Search, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { useUnreadStore } from '../../context/unreadStore';
import { getSocket, waitForSocket } from '../../utils/socket';
import api from '../../utils/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  online: 'bg-status-online', idle: 'bg-status-idle',
  dnd: 'bg-status-dnd', offline: 'bg-status-offline',
};

export default function DMSidebar({ activeDM, onDMSelect }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const { user } = useAuthStore();
  const { getDMUnread } = useUnreadStore();

  // Fetch on mount and whenever socket reconnects
  useEffect(() => {
    fetchConversations();

    const setupSocket = async () => {
      const socket = await waitForSocket();

      const onDMMessage = ({ conversationId, message }) => {
        setConversations(prev => {
          const exists = prev.find(c => c._id === conversationId);
          if (!exists) { fetchConversations(); return prev; }
          const updated = prev.map(c =>
            c._id === conversationId ? { ...c, lastMessage: message, lastActivity: new Date() } : c
          );
          return [...updated].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        });
      };

      // Also refetch on reconnect so the list is always fresh
      const onReconnect = () => fetchConversations();

      socket.on('dm:message', onDMMessage);
      socket.on('connect', onReconnect);
      return () => {
        socket.off('dm:message', onDMMessage);
        socket.off('connect', onReconnect);
      };
    };

    let cleanup = () => {};
    setupSocket().then(fn => { if (fn) cleanup = fn; });
    return () => cleanup();
  }, []);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/dms');
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch DMs');
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally { setSearching(false); }
  };

  const startDM = async (userId) => {
    try {
      const { data } = await api.post(`/dms/start/${userId}`);
      if (data.privacyBlocked) {
        toast.error(data.error, { duration: 4000 });
        if (data.suggestion) toast(data.suggestion, { icon: '💡', duration: 5000 });
        return;
      }
      const conversation = data.conversation || data;
      setConversations(prev => {
        const exists = prev.find(c => c._id === conversation._id);
        return exists ? prev : [conversation, ...prev];
      });
      onDMSelect(conversation);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      const d = err.response?.data;
      if (d?.privacyBlocked) {
        toast.error(d.error, { duration: 4000 });
        if (d.suggestion) toast(d.suggestion, { icon: '💡', duration: 5000 });
      } else {
        toast.error('Failed to open conversation');
      }
    }
  };

  const getOtherParticipant = (conv) =>
    conv.participants?.find(p => (p._id || p) !== user._id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-3 flex items-center border-b border-surface-300 shadow-sm flex-shrink-0">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full bg-surface-900 text-text-primary text-sm pl-7 pr-3 py-1.5 rounded-md placeholder-text-muted focus:outline-none"
            placeholder="Find or start a DM"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="border-b border-surface-300">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Users</p>
          {searchResults.map(u => (
            <button key={u._id} onClick={() => startDM(u._id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-400 transition-colors">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: u.avatarColor || '#4f46e5' }}>
                  {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                </div>
                <div className={`status-dot absolute -bottom-0.5 -right-0.5 ${STATUS_COLORS[u.status || 'offline']}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{u.displayName || u.username}</p>
                <p className="text-xs text-text-muted">#{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DM label */}
      <p className="px-3 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider flex-shrink-0">
        Direct Messages
      </p>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto pb-2">
        {conversations.length === 0 && !searchQuery && (
          <div className="text-center py-8 px-4">
            <MessageCircle size={32} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">No conversations yet</p>
            <p className="text-text-muted text-xs mt-1">Search for a user above to start chatting</p>
          </div>
        )}

        {(Array.isArray(conversations) ? conversations : []).map(conv => {
          const other = getOtherParticipant(conv);
          if (!other) return null;
          const initials = (other.displayName || other.username || '?').slice(0, 2).toUpperCase();
          const unread = getDMUnread(conv._id);
          const isActive = activeDM?._id === conv._id;

          return (
            <button
              key={conv._id}
              onClick={() => onDMSelect(conv)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 mx-1 rounded-lg transition-colors ${
                isActive ? 'bg-surface-400' : 'hover:bg-surface-400/60'
              }`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              {/* Avatar with unread dot */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: other.avatarColor || '#4f46e5' }}>
                  {other.avatar
                    ? <img src={other.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    : initials}
                </div>
                <div className={`status-dot absolute -bottom-0.5 -right-0.5 ${STATUS_COLORS[other.status || 'offline']}`} />
              </div>

              {/* Name + preview */}
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-sm truncate ${unread > 0 && !isActive ? 'font-bold text-text-primary' : 'font-medium text-text-primary'}`}>
                  {other.displayName || other.username}
                </p>
                {conv.lastMessage && (
                  <p className={`text-xs truncate ${unread > 0 && !isActive ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
                    {conv.lastMessage.content || '📎 Attachment'}
                  </p>
                )}
              </div>

              {/* Right side: time + unread badge */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {conv.lastActivity && (
                  <span className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(conv.lastActivity), { addSuffix: false })}
                  </span>
                )}
                {unread > 0 && !isActive && (
                  <span className="bg-brand-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
