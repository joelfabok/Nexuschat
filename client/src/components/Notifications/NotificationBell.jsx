import { useState, useEffect, useRef } from 'react';
import { Bell, UserPlus, MessageSquareDashed, Check, CheckCheck, X, UserCheck } from 'lucide-react';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';

const TYPE_META = {
  friend_request: { icon: UserPlus, color: 'text-indigo-400', label: 'Friend Request' },
  friend_request_accepted: { icon: UserCheck, color: 'text-green-400', label: 'Now Friends' },
  friend_request_declined: { icon: X, color: 'text-red-400', label: 'Request Declined' },
  dm_blocked: { icon: MessageSquareDashed, color: 'text-yellow-400', label: 'DM Blocked' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Real-time new notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(c => c + 1);
    };
    socket.on('notification:new', handler);
    return () => socket.off('notification:new', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    const wasUnread = notifications.find(n => n._id === id && !n.read);
    setNotifications(prev => prev.filter(n => n._id !== id));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
  };

  const removeNotification = (notifId) => {
    setNotifications(prev => prev.filter(n => n._id !== notifId));
  };

  const acceptFriendRequest = async (notif, e) => {
    e.stopPropagation();
    try {
      await api.post(`/friends/accept/${notif.friendRequestId}`);
      removeNotification(notif._id);
      setUnreadCount(c => Math.max(0, c - 1));
      fetchNotifications();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept');
    }
  };

  const declineFriendRequest = async (notif, e) => {
    e.stopPropagation();
    try {
      await api.post(`/friends/decline/${notif.friendRequestId}`);
      removeNotification(notif._id);
      setUnreadCount(c => Math.max(0, c - 1));
      fetchNotifications();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to decline');
    }
  };

  const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-700/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No notifications yet</div>
            ) : notifications.map(notif => {
              const meta = TYPE_META[notif.type] || TYPE_META.friend_request;
              const Icon = meta.icon;
              return (
                <div
                  key={notif._id}
                  onClick={() => !notif.read && markRead(notif._id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-750 transition-colors relative ${!notif.read ? 'bg-gray-700/30' : ''}`}
                >
                  {/* Unread dot */}
                  {!notif.read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />}

                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                    <Icon size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-200 leading-snug">{notif.message}</p>
                      <button onClick={(e) => deleteNotif(notif._id, e)} className="shrink-0 text-gray-600 hover:text-gray-400">
                        <X size={14} />
                      </button>
                    </div>
                    {notif.suggestion && (
                      <p className="text-xs text-gray-500 mt-0.5">{notif.suggestion}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">{timeAgo(notif.createdAt)}</p>

                    {/* Friend request actions */}
                    {notif.type === 'friend_request' && notif.friendRequestId && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => acceptFriendRequest(notif, e)}
                          className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          onClick={(e) => declineFriendRequest(notif, e)}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                        >
                          <X size={12} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
