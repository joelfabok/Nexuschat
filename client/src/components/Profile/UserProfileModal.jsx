import { useState, useEffect } from 'react';
import {
  X, MapPin, Globe, Twitter, Github, Instagram,
  UserPlus, UserCheck, UserMinus, MessageCircle, Edit2, Check,
  Calendar, Users, Crown, Zap, Clock,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import toast from 'react-hot-toast';

const BANNER_COLORS = [
  '#1e1b4b', '#1e3a5f', '#14532d', '#3b1f2b',
  '#1c1f2e', '#2d1b4e', '#0c2340', '#1a1a2e',
  '#2d2006', '#1a2e1a', '#2e1a1a', '#1a2e2e',
];

const AVATAR_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#0284c7',
  '#6d28d9', '#be185d', '#b45309', '#065f46',
];

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function TierBadge({ tier }) {
  if (!tier || tier === 'free') return null;
  return tier === 'creator'
    ? <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium"><Crown size={10} /> Creator</span>
    : <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full font-medium"><Zap size={10} /> Pro</span>;
}

export default function UserProfileModal({ userId, onClose, onStartDM }) {
  const { user: me, updateUser } = useAuthStore();
  const isOwnProfile = userId === me._id || userId === me._id?.toString();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editBio, setEditBio] = useState('');
  const [editBannerColor, setEditBannerColor] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editTwitter, setEditTwitter] = useState('');
  const [editGithub, setEditGithub] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editStatusPost, setEditStatusPost] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${userId}`);
      setProfile(data);
      if (isOwnProfile) {
        setEditBio(data.bio || '');
        setEditBannerColor(data.bannerColor || '#1e1b4b');
        setEditAvatarColor(data.avatarColor || '#4f46e5');
        setEditDisplayName(data.displayName || '');
        setEditLocation(data.location || '');
        setEditWebsite(data.website || '');
        setEditTwitter(data.socialLinks?.twitter || '');
        setEditGithub(data.socialLinks?.github || '');
        setEditInstagram(data.socialLinks?.instagram || '');
        setEditStatusPost(data.statusPost || '');
      }
    } catch {
      toast.error('Failed to load profile');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [userId]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', {
        displayName: editDisplayName,
        bio: editBio,
        bannerColor: editBannerColor,
        avatarColor: editAvatarColor,
        location: editLocation,
        website: editWebsite,
        socialLinks: { twitter: editTwitter, github: editGithub, instagram: editInstagram },
        statusPost: editStatusPost,
      });
      setProfile(prev => ({ ...prev, ...data }));
      updateUser(data);
      setEditing(false);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const sendFriendRequest = async () => {
    try {
      await api.post(`/friends/request/${userId}`);
      setProfile(prev => ({ ...prev, friendStatus: 'request_sent' }));
      toast.success('Friend request sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    }
  };

  const acceptFriendRequest = async () => {
    try {
      await api.post(`/friends/accept/${profile.pendingRequestId}`);
      setProfile(prev => ({ ...prev, friendStatus: 'friends' }));
      toast.success('Friend request accepted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept');
    }
  };

  const unfriend = async () => {
    if (!confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${userId}`);
      setProfile(prev => ({ ...prev, friendStatus: 'none' }));
      toast.success('Friend removed');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unfriend');
    }
  };

  const startDM = async () => {
    try {
      const { data } = await api.post(`/dms/start/${userId}`);
      if (data.privacyBlocked) {
        toast.error(data.error);
        if (data.suggestion) toast(data.suggestion, { icon: '💡' });
        return;
      }
      onStartDM?.(data.conversation || data);
      onClose();
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.error || 'Cannot open DM');
      if (d?.suggestion) toast(d.suggestion, { icon: '💡' });
    }
  };

  const STATUS_COLORS = { online: 'bg-green-500', idle: 'bg-yellow-500', dnd: 'bg-red-500', offline: 'bg-gray-500' };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-8" onClick={e => e.stopPropagation()}>
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );

  const bannerColor = editing ? editBannerColor : (profile?.bannerColor || '#1e1b4b');
  const avatarColor = editing ? editAvatarColor : (profile?.avatarColor || '#4f46e5');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-28" style={{ background: bannerColor }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 text-white rounded-lg transition-colors">
            <X size={16} />
          </button>

          {/* Color pickers when editing */}
          {editing && (
            <div className="absolute bottom-2 left-3 flex gap-2">
              <div>
                <p className="text-white/60 text-xs mb-1">Banner</p>
                <div className="flex gap-1 flex-wrap w-40">
                  {BANNER_COLORS.map(c => (
                    <button key={c} onClick={() => setEditBannerColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${editBannerColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Avatar */}
          <div className="absolute -bottom-10 left-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-gray-800 flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: avatarColor }}>
                {profile?.avatar
                  ? <img src={profile.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                  : (profile?.displayName || profile?.username)?.[0]?.toUpperCase()}
              </div>
              <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${STATUS_COLORS[profile?.status] || 'bg-gray-500'}`} />
            </div>
            {editing && (
              <div className="mt-1">
                <p className="text-white/60 text-xs mb-1">Avatar color</p>
                <div className="flex gap-1 flex-wrap w-28">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setEditAvatarColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${editAvatarColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pt-14 px-5 pb-5 space-y-4">
          {/* Name row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {editing ? (
                <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
                  className="bg-gray-700 text-white text-xl font-bold rounded-lg px-2 py-1 w-full outline-none focus:ring-2 ring-indigo-500"
                  maxLength={32} placeholder="Display name" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white truncate">{profile?.displayName || profile?.username}</h2>
                  <TierBadge tier={profile?.subscriptionTier} />
                </div>
              )}
              <p className="text-gray-500 text-sm">
                {profile?.username}{profile?.userTag ? <span className="text-gray-600">#{profile.userTag}</span> : ''}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Users size={11} /> {profile?.friendCount || 0} friends</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> Joined {new Date(profile?.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {isOwnProfile ? (
                editing ? (
                  <button onClick={saveProfile} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                    <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                    <Edit2 size={14} /> Edit
                  </button>
                )
              ) : (
                <>
                  {profile?.friendStatus === 'none' && (
                    <button onClick={sendFriendRequest}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors">
                      <UserPlus size={14} /> Add Friend
                    </button>
                  )}
                  {profile?.friendStatus === 'request_sent' && (
                    <button disabled className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-400 text-sm rounded-lg cursor-not-allowed">
                      <Clock size={14} /> Requested
                    </button>
                  )}
                  {profile?.friendStatus === 'request_received' && (
                    <button onClick={acceptFriendRequest}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors">
                      <UserCheck size={14} /> Accept
                    </button>
                  )}
                  {profile?.friendStatus === 'friends' && (
                    <button onClick={unfriend}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors">
                      <UserMinus size={14} /> Unfriend
                    </button>
                  )}
                  <button onClick={startDM}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                    <MessageCircle size={14} /> Message
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status post */}
          {(profile?.statusPost || editing) && (
            <div className="bg-gray-750 rounded-xl p-3 border border-gray-700">
              {editing ? (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Status post ({editStatusPost.length}/280)</p>
                  <textarea value={editStatusPost} onChange={e => setEditStatusPost(e.target.value)}
                    maxLength={280} rows={3} placeholder="What's on your mind?"
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
                </div>
              ) : (
                <>
                  <p className="text-gray-200 text-sm leading-relaxed">{profile.statusPost}</p>
                  {profile.statusPostUpdatedAt && (
                    <p className="text-gray-600 text-xs mt-1.5 flex items-center gap-1">
                      <Clock size={10} /> {timeAgo(profile.statusPostUpdatedAt)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bio */}
          {editing ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">Bio ({editBio.length}/300)</p>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                maxLength={300} rows={3} placeholder="Tell people about yourself..."
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
            </div>
          ) : profile?.bio ? (
            <p className="text-gray-300 text-sm leading-relaxed">{profile.bio}</p>
          ) : null}

          {/* Location & website */}
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Location</p>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                  maxLength={64} placeholder="City, Country"
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Website</p>
                <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)}
                  maxLength={128} placeholder="https://..."
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
              </div>
            </div>
          ) : (profile?.location || profile?.website) ? (
            <div className="flex flex-wrap gap-3 text-sm text-gray-400">
              {profile.location && <span className="flex items-center gap-1.5"><MapPin size={13} /> {profile.location}</span>}
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"><Globe size={13} /> {profile.website.replace(/^https?:\/\//, '')}</a>}
            </div>
          ) : null}

          {/* Social links */}
          {editing ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Social links</p>
              <div className="flex items-center gap-2">
                <Twitter size={14} className="text-sky-400 shrink-0" />
                <input value={editTwitter} onChange={e => setEditTwitter(e.target.value)}
                  maxLength={64} placeholder="@username"
                  className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
              </div>
              <div className="flex items-center gap-2">
                <Github size={14} className="text-gray-400 shrink-0" />
                <input value={editGithub} onChange={e => setEditGithub(e.target.value)}
                  maxLength={64} placeholder="username"
                  className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
              </div>
              <div className="flex items-center gap-2">
                <Instagram size={14} className="text-pink-400 shrink-0" />
                <input value={editInstagram} onChange={e => setEditInstagram(e.target.value)}
                  maxLength={64} placeholder="@username"
                  className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 ring-indigo-500 placeholder-gray-500" />
              </div>
            </div>
          ) : (profile?.socialLinks?.twitter || profile?.socialLinks?.github || profile?.socialLinks?.instagram) ? (
            <div className="flex gap-3">
              {profile.socialLinks.twitter && (
                <a href={`https://twitter.com/${profile.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sky-400 transition-colors">
                  <Twitter size={14} /> {profile.socialLinks.twitter}
                </a>
              )}
              {profile.socialLinks.github && (
                <a href={`https://github.com/${profile.socialLinks.github}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                  <Github size={14} /> {profile.socialLinks.github}
                </a>
              )}
              {profile.socialLinks.instagram && (
                <a href={`https://instagram.com/${profile.socialLinks.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-pink-400 transition-colors">
                  <Instagram size={14} /> {profile.socialLinks.instagram}
                </a>
              )}
            </div>
          ) : null}

          {/* Cancel button when editing */}
          {editing && (
            <button onClick={() => setEditing(false)}
              className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
