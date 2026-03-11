import { useState } from 'react';
import { X, Server, Trash2, Crown, AlertTriangle, Check } from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import toast from 'react-hot-toast';

const TABS = ['Overview', 'Members', 'Roles', 'Invites', 'Danger Zone'];

export default function ServerSettingsModal({ server, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('Overview');
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const { user } = useAuthStore();

  const isOwner = server.owner === user._id || server.owner?._id === user._id;
  const myRole = server.members?.find(m => (m.user?._id || m.user) === user._id)?.role;
  const canManage = ['owner', 'admin'].includes(myRole);

  const saveOverview = async () => {
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const { data } = await api.patch(`/servers/${server._id}`, { name: name.trim(), description: description.trim() });
      onUpdate(data);
      toast.success('Server updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteServer = async () => {
    if (confirmDelete !== server.name) return toast.error('Type the server name to confirm');
    try {
      await api.delete(`/servers/${server._id}`);
      toast.success('Server deleted');
      onDelete(server._id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const kickMember = async (memberId) => {
    try {
      await api.post(`/servers/${server._id}/kick/${memberId}`);
      onUpdate({ ...server, members: server.members.filter(m => (m.user?._id || m.user) !== memberId) });
      toast.success('Member kicked');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const changeRole = async (memberId, role) => {
    try {
      await api.patch(`/servers/${server._id}/members/${memberId}`, { role });
      onUpdate({
        ...server,
        members: server.members.map(m =>
          (m.user?._id || m.user) === memberId ? { ...m, role } : m
        ),
      });
      toast.success('Role updated');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-surface-700 border border-surface-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex overflow-hidden shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>

        {/* Sidebar tabs */}
        <div className="w-48 bg-surface-800 p-3 flex flex-col gap-0.5 border-r border-surface-300 flex-shrink-0">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider px-2 py-1 mb-1 truncate">{server.name}</p>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === t ? 'bg-surface-500 text-text-primary font-medium' :
                t === 'Danger Zone' ? 'text-status-dnd hover:bg-surface-500/50' :
                'text-text-secondary hover:text-text-primary hover:bg-surface-500/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 flex-shrink-0">
            <h2 className="font-display font-bold text-text-primary">{tab}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'Overview' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Server Name</label>
                  <input
                    className="input-base"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={!canManage}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea
                    className="input-base resize-none h-24"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={!canManage}
                    maxLength={500}
                    placeholder="What's this server about?"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-300">
                  <p className="text-xs text-text-muted">Server ID: <span className="font-mono">{server._id}</span></p>
                  {canManage && (
                    <button onClick={saveOverview} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === 'Members' && (
              <div className="space-y-2">
                {server.members?.map(m => {
                  const u = m.user;
                  if (!u || typeof u === 'string') return null;
                  const memberId = u._id;
                  const isSelf = memberId === user._id;
                  return (
                    <div key={memberId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-500/30 group">
                      <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {(u.displayName || u.username || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{u.displayName || u.username}</p>
                        <p className="text-xs text-text-muted">#{u.username}</p>
                      </div>
                      <RoleBadge role={m.role} />
                      {canManage && !isSelf && m.role !== 'owner' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isOwner && (
                            <select
                              value={m.role}
                              onChange={e => changeRole(memberId, e.target.value)}
                              className="text-xs bg-surface-500 border border-surface-300 rounded px-1.5 py-1 text-text-secondary focus:outline-none"
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                          <button
                            onClick={() => kickMember(memberId)}
                            className="text-status-dnd hover:bg-status-dnd/20 p-1.5 rounded transition-colors"
                            title="Kick member"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'Roles' && (
              <div className="space-y-3">
                <p className="text-text-secondary text-sm mb-4">Roles are assigned per member. Use the Members tab to change someone's role.</p>
                {[
                  { role: 'owner', desc: 'Full control. Can delete server, manage all settings.', color: 'text-yellow-400' },
                  { role: 'admin', desc: 'Can manage channels, kick/ban members, manage roles.', color: 'text-brand-400' },
                  { role: 'moderator', desc: 'Can delete messages, kick members.', color: 'text-blue-400' },
                  { role: 'member', desc: 'Can read and send messages in accessible channels.', color: 'text-text-secondary' },
                ].map(({ role, desc, color }) => (
                  <div key={role} className="flex items-start gap-3 p-4 bg-surface-600 rounded-xl border border-surface-300">
                    <RoleBadge role={role} />
                    <p className="text-sm text-text-secondary">{desc}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Invites' && (
              <InviteTab server={server} />
            )}

            {tab === 'Danger Zone' && isOwner && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-status-dnd/10 border border-status-dnd/30 rounded-xl">
                  <AlertTriangle size={20} className="text-status-dnd flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">Delete Server</p>
                    <p className="text-xs text-text-secondary mb-3">This permanently deletes <strong>{server.name}</strong> and all its channels, messages, and data. This cannot be undone.</p>
                    <label className="block text-xs text-text-muted mb-1.5">Type <strong className="text-text-primary">{server.name}</strong> to confirm:</label>
                    <input
                      className="input-base text-sm mb-3"
                      placeholder={server.name}
                      value={confirmDelete}
                      onChange={e => setConfirmDelete(e.target.value)}
                    />
                    <button
                      onClick={deleteServer}
                      disabled={confirmDelete !== server.name}
                      className="flex items-center gap-2 bg-status-dnd hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} /> Delete Server
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const styles = {
    owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    admin: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
    moderator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    member: 'bg-surface-400 text-text-muted border-surface-300',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${styles[role] || styles.member}`}>
      {role}
    </span>
  );
}

function InviteTab({ server }) {
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/servers/${server._id}/invite`);
      setInviteLink(`${window.location.origin}/invite/${data.inviteCode}`);
    } catch (err) {
      toast.error('Failed to generate invite');
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  return (
    <div className="space-y-4">
      <p className="text-text-secondary text-sm">Share an invite link for friends to join <strong>{server.name}</strong>.</p>
      {!inviteLink ? (
        <button onClick={generateInvite} disabled={loading} className="btn-primary text-sm px-5 py-2">
          {loading ? 'Generating…' : 'Generate Invite Link'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className="input-base text-sm flex-1 font-mono" readOnly value={inviteLink} />
            <button onClick={copy} className={`btn-primary flex-shrink-0 flex items-center gap-1.5 px-4 ${copied ? 'bg-status-online' : ''}`}>
              {copied ? <Check size={14} /> : null} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button onClick={generateInvite} className="text-xs text-text-muted hover:text-text-secondary underline transition-colors">
            Generate new link (invalidates old one)
          </button>
        </div>
      )}
    </div>
  );
}
