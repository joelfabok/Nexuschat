import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Search, Check, X, Clock, Users } from 'lucide-react';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import { useProfile } from '../../context/ProfileContext';

const TABS = ['Friends', 'Pending', 'Add Friend'];

export default function FriendsPanel({ onStartDM }) {
  const { openProfile } = useProfile() || {};
  const [tab, setTab] = useState('Friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  

  const fetchFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch {}
  };

  const fetchRequests = async () => {
    try {
      const { data } = await api.get('/friends/requests');
      setRequests(data);
    } catch {}
  };

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  useEffect(() => {
  const socket = getSocket();
  if (!socket) return;
  socket.on('friends:updated', () => { fetchFriends(); fetchRequests(); });
  return () => socket.off('friends:updated');
}, []);

  const searchUsers = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } catch {}
  };

  const sendRequest = async (userId) => {
    try {
      await api.post(`/friends/request/${userId}`);
      setSentIds(prev => new Set([...prev, userId]));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send request');
    }
  };

  const accept = async (requestId) => {
    try {
      await api.post(`/friends/accept/${requestId}`);
      fetchFriends();
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept');
    }
  };

  const decline = async (requestId) => {
    try {
      await api.post(`/friends/decline/${requestId}`);
      fetchRequests();
    } catch {}
  };

  const unfriend = async (userId) => {
    if (!confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${userId}`);
      fetchFriends();
    } catch {}
  };

  const startDM = async (userId) => {
    try {
      const { data } = await api.post(`/dms/start/${userId}`);
      if (data.privacyBlocked) {
        alert(data.error + (data.suggestion ? `\n\n${data.suggestion}` : ''));
        return;
      }
      onStartDM?.(data.conversation);
    } catch (err) {
      const d = err.response?.data;
      alert(d?.error || 'Cannot open DM' + (d?.suggestion ? `\n\n${d.suggestion}` : ''));
    }
  };

  const Avatar = ({ user, size = 8 }) => (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}
      style={{ background: user.avatarColor || '#4f46e5' }}>
      {user.avatar
        ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" />
        : (user.displayName || user.username)?.[0]?.toUpperCase()}
    </div>
  );

  const StatusDot = ({ status }) => {
    const colors = { online: 'bg-green-500', idle: 'bg-yellow-500', dnd: 'bg-red-500', offline: 'bg-gray-500' };
    return <span className={`w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${colors[status] || colors.offline}`} />;
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4 pb-2 border-b border-gray-700">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
            {t}
            {t === 'Pending' && requests.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">

        {/* ── Friends tab ── */}
        {tab === 'Friends' && (
          <>
            {friends.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p>No friends yet. Add some!</p>
              </div>
            ) : friends.map(friend => (
              <div key={friend._id} className="flex items-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded-lg group transition-colors">
                <div className="relative">
                  <Avatar user={friend} size={7} />
                  <div className="absolute -bottom-0.5 -right-0.5"><StatusDot status={friend.status} /></div>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openProfile?.(friend._id)}>
                  <p className="font-medium text-white text-xs truncate">{friend.displayName || friend.username}</p>
                  <p className="text-[11px] text-gray-400 truncate">{friend.customStatus || friend.status}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startDM(friend._id)}
                    className="px-2 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                    Message
                  </button>
                  <button onClick={() => unfriend(friend._id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors">
                    <UserMinus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Pending tab ── */}
        {tab === 'Pending' && (
          <>
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock size={40} className="mx-auto mb-3 opacity-30" />
                <p>No pending requests</p>
              </div>
            ) : requests.map(req => (
              <div key={req._id} className="flex items-center gap-3 p-3 bg-gray-750 rounded-xl">
                <Avatar user={req.sender} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{req.sender.displayName || req.sender.username}</p>
                  <p className="text-xs text-gray-500">Wants to be friends</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => accept(req._id)}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={() => decline(req._id)}
                    className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Add Friend tab ── */}
        {tab === 'Add Friend' && (
          <>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchQ}
                onChange={e => searchUsers(e.target.value)}
                placeholder="Search by username or username#1234..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {searchResults.length === 0 && searchQ.length >= 2 && (
              <p className="text-center text-gray-500 text-sm py-4">No users found</p>
            )}

            {searchResults.map(user => (
              <div key={user._id} className="flex items-center gap-2 p-2 bg-gray-750 rounded-lg">
                <Avatar user={user} size={7} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openProfile?.(user._id)}>
                  <p className="font-medium text-white text-xs truncate">{user.displayName || user.username}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => sendRequest(user._id)}
                    disabled={sentIds.has(user._id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${sentIds.has(user._id) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    <UserPlus size={12} />
                    {sentIds.has(user._id) ? 'Sent' : 'Add Friend'}
                  </button>
                  <p className="text-[11px] text-gray-400">{user.username}{user.userTag ? `#${user.userTag}` : ''}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
