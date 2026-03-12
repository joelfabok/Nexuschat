import { useState, useEffect, useRef, useCallback } from 'react';
import { Hash, Paperclip, Send, Smile, BarChart2, Flag, MoreHorizontal, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../context/authStore';
import { getSocket } from '../../utils/socket';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import VoiceChannel from '../Voice/VoiceChannel';
import MessageReactions from './MessageReactions';
import PollMessage from './PollMessage';
import { useProfile } from '../../context/ProfileContext';
import CreatePollModal from './CreatePollModal';
import { useUnreadStore } from '../../context/unreadStore';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👀'];

export default function ChatArea({ channel, server }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuthStore();
  const { markChannelRead } = useUnreadStore();

  const member = server?.members?.find(m => (m.user?._id || m.user) === user._id || (m.user?._id || m.user) === String(user._id));
  const role = member?.role || 'member';
  const isStaff = ['owner', 'admin', 'moderator'].includes(role);
  const canCreatePoll = isStaff;
  const hasAcceptedRules = !server?.requiresRulesAgreement || member?.acceptedRules;
  const canPostInAnnouncement = channel?.type !== 'announcement' || isStaff;
  const canPostInLocked = !channel?.locked || ['owner', 'admin'].includes(role);
  const canPost = Boolean(channel) && canPostInAnnouncement && canPostInLocked && hasAcceptedRules;

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  };

  useEffect(() => {
    if (!channel || channel.type === 'voice') return;
    setMessages([]);
    setLoading(true);
    api.get(`/messages/channel/${channel._id}`)
      .then(({ data }) => { setMessages(data); setTimeout(() => scrollToBottom(false), 50); })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false));
    markChannelRead(channel._id);
  }, [channel?._id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channel) return;

    const onNewMessage = (msg) => {
      if (msg.channel === channel._id) {
        setMessages(prev => [...prev, msg]);
        setTimeout(scrollToBottom, 50);
        markChannelRead(channel._id);
      }
    };
    const onEdited = (msg) => setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
    const onDeleted = ({ messageId }) => setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true, content: '[Message deleted]' } : m));
    const onReaction = ({ messageId, reactions }) => setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    const onPollUpdated = (poll) => setMessages(prev => prev.map(m => m.poll?._id === poll._id ? { ...m, poll } : m));
    const onTypingUpdate = ({ channelId, userId, username, isTyping }) => {
      if (channelId !== channel._id || userId === user._id) return;
      setTypingUsers(prev => isTyping ? [...prev.filter(u => u.userId !== userId), { userId, username }] : prev.filter(u => u.userId !== userId));
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('message:reaction', onReaction);
    socket.on('poll:updated', onPollUpdated);
    socket.on('typing:update', onTypingUpdate);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('message:reaction', onReaction);
      socket.off('poll:updated', onPollUpdated);
      socket.off('typing:update', onTypingUpdate);
    };
  }, [channel?._id, user._id]);

  const sendTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !channel) return;
    socket.emit('typing:start', { channelId: channel._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop', { channelId: channel._id }), 3000);
  }, [channel?._id]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!canPost) {
      if (!hasAcceptedRules && server?.requiresRulesAgreement) {
        toast.error('You must accept server rules before posting');
      } else {
        toast.error(channel.type === 'announcement'
          ? 'Only staff can post in announcement channels'
          : 'Channel is locked for normal users');
      }
      return;
    }

    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    try {
      await api.post(`/messages/channel/${channel._id}`, { content, server: server?._id });
    } catch (err) {
      if (err?.response?.status === 403 && err?.response?.data?.requiresRulesAgreement) {
        toast.error('You must agree to channel rules before posting');
      } else {
        toast.error('Failed to send message');
      }
      setInput(content);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 1 * 1024 * 1024 * 1024;
    if (file.size > MAX) { toast.error('File too large (max 1 GB)'); return; }
    const CHUNK = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK);
    const uploadId = crypto.randomUUID();
    setUploading(true); setUploadProgress(0);
    try {
      let fileData = null;
      for (let i = 0; i < totalChunks; i++) {
        const blob = file.slice(i * CHUNK, (i + 1) * CHUNK);
        const form = new FormData();
        form.append('chunk', blob); form.append('uploadId', uploadId);
        form.append('chunkIndex', i); form.append('totalChunks', totalChunks);
        form.append('filename', file.name); form.append('mimetype', file.type);
        form.append('totalSize', file.size);
        const { data } = await api.post('/files/chunk', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        if (i === totalChunks - 1) fileData = data;
      }
      await api.post(`/messages/channel/${channel._id}`, { content: '', attachments: [fileData] });
      setUploadProgress(0);
    } catch { api.delete(`/files/chunk/${uploadId}`).catch(() => {}); toast.error('Upload failed'); setUploadProgress(0); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const addEmojiToInput = (emoji) => { setInput(p => p + emoji); setShowEmojiBar(false); };

  if (channel.type === 'voice') return <VoiceChannel channel={channel} server={server} />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-surface-300 shadow-sm flex-shrink-0">
        <Hash size={18} className="text-text-muted flex-shrink-0" />
        <h3 className="font-semibold text-text-primary truncate">{channel.name}</h3>
        {channel.topic && (
          <><div className="w-px h-4 bg-surface-300 mx-1 flex-shrink-0" /><p className="text-text-secondary text-xs truncate">{channel.topic}</p></>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-0.5 scrollbar-hide">
        {loading && <div className="flex items-center justify-center h-32 text-text-muted text-sm">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-500 flex items-center justify-center mx-auto mb-3"><Hash size={28} className="text-text-muted" /></div>
            <h4 className="font-display font-bold text-text-primary mb-1">#{channel.name}</h4>
            <p className="text-text-secondary text-sm">The beginning of #{channel.name}. Say something!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.author?._id === msg.author?._id && (new Date(msg.createdAt) - new Date(prev.createdAt)) < 5 * 60 * 1000 && !prev.poll && !msg.poll;
          return <MessageItem key={msg._id} message={msg} grouped={grouped} currentUserId={user._id} channel={channel} server={server} />;
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-1 text-xs text-text-secondary flex items-center gap-1">
          <span className="font-medium">{typingUsers.map(u => u.username).join(', ')}</span>
          {typingUsers.length === 1 ? ' is' : ' are'} typing
          <span className="flex gap-0.5 ml-1">{[0,1,2].map(i=><span key={i} className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{animationDelay:`${i*200}ms`}}/>)}</span>
        </div>
      )}

      {/* Input */}
      <div className="px-3 flex-shrink-0" style={{ paddingTop: '8px', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
        {server?.requiresRulesAgreement && !hasAcceptedRules && (
          <div className="mb-2 p-2 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs">
            <p className="font-medium">You must accept the server rules before posting.</p>
            <p className="mt-1 text-xs text-text-secondary">{server.rulesText || 'No rules text provided yet.'}</p>
          </div>
        )}

        {!canPost && !server?.requiresRulesAgreement && (
          <div className="mb-2 p-2 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-800 text-xs">
            {channel.type === 'announcement'
              ? 'This is an announcement channel: only staff can post here.'
              : 'This channel is locked: only server owner/admin can post.'}
          </div>
        )}

        {showEmojiBar && (
          <div className="flex items-center gap-1 mb-2 p-2 bg-surface-600 rounded-xl border border-surface-300">
            {QUICK_EMOJIS.map(e => (
              <button key={e} onClick={() => addEmojiToInput(e)} className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-surface-500 transition-all active:scale-90">{e}</button>
            ))}
            <button onClick={() => setShowEmojiBar(false)} className="ml-auto text-text-muted hover:text-text-primary"><X size={14} /></button>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-surface-500 rounded-xl px-2 py-2 border border-surface-300 focus-within:border-brand-500/50 transition-colors">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0 rounded-lg hover:bg-surface-400">
            <Paperclip size={16} />
          </button>
          <button type="button" onClick={() => setShowEmojiBar(p => !p)}
            className={`w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0 rounded-lg hover:bg-surface-400 ${showEmojiBar ? 'text-brand-400' : 'text-text-muted hover:text-text-primary'}`}>
            <Smile size={16} />
          </button>
          {canCreatePoll ? (
            <button type="button" onClick={() => setShowPollModal(true)}
              className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors flex-shrink-0 rounded-lg hover:bg-surface-400"
              title="Create poll">
              <BarChart2 size={16} />
            </button>
          ) : (
            <button type="button" disabled
              className="w-8 h-8 flex items-center justify-center text-text-muted/50 cursor-not-allowed transition-colors flex-shrink-0 rounded-lg">
              <BarChart2 size={16} />
            </button>
          )}
          <input
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-sm focus:outline-none min-w-0"
            placeholder={canPost ? `Message #${channel.name}` : 'Read-only channel'}
            value={input}
            onChange={e => { setInput(e.target.value); if (canPost) sendTyping(); }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
            disabled={!canPost}
          />
          <button onClick={sendMessage} disabled={!canPost || !input.trim()}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-brand-400 disabled:opacity-30 transition-colors flex-shrink-0 rounded-lg hover:bg-surface-400">
            <Send size={16} />
          </button>
        </div>
        {uploading && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-text-muted mb-1"><span>Uploading…</span><span>{uploadProgress}%</span></div>
            <div className="h-1.5 bg-surface-400 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {showPollModal && <CreatePollModal channel={channel} server={server} onClose={() => setShowPollModal(false)} />}
    </div>
  );
}

function MessageItem({ message, grouped, currentUserId, channel, server }) {
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useAuthStore();
  const { openProfile } = useProfile() || {};
  const isOwn = message.author?._id === currentUserId;
  const initials = (message.author?.displayName || message.author?.username || '?').slice(0, 2).toUpperCase();
  const isImage = (mt) => mt?.startsWith('image/');

  const deleteMessage = async () => {
    setShowMenu(false);
    try { await api.delete(`/messages/${message._id}`); }
    catch { toast.error('Failed to delete'); }
  };

  const reportMessage = async () => {
    setShowMenu(false);
    try {
      await api.post('/moderation/report', { targetMessageId: message._id, serverId: server?._id, reason: 'other', details: '' });
      toast.success('Message reported');
    } catch { toast.error('Failed to report'); }
  };

  const role = server?.members?.find(m => (m.user?._id || m.user) === user._id || (m.user?._id || m.user) === String(user._id))?.role || 'member';
  const isStaff = ['owner', 'admin', 'moderator'].includes(role);
  const canDelete = isOwn || isStaff;

  return (
    <div className={`group message-bubble flex gap-3 ${grouped ? 'pt-0.5' : 'pt-4'}`}>
      {!grouped ? (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
          style={{ backgroundColor: message.author?.avatarColor || '#4f46e5' }}
          onClick={() => openProfile?.(message.author?._id)}
          title={`View ${message.author?.displayName || message.author?.username}'s profile`}>
          {message.author?.avatar ? <img src={message.author.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : initials}
        </div>
      ) : <div className="w-10 flex-shrink-0" />}

      <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
            <span
              className="font-semibold text-text-primary text-sm cursor-pointer hover:underline"
              onClick={() => openProfile?.(message.author?._id)}
            >{message.author?.displayName || message.author?.username}</span>
            <span className="text-xs text-text-muted">{format(new Date(message.createdAt), 'MMM d, h:mm a')}</span>
            {message.edited && <span className="text-xs text-text-muted">(edited)</span>}
          </div>
        )}

        {message.deleted ? (
          <p className="text-text-muted text-sm italic">[Message deleted]</p>
        ) : (
          <>
            {message.poll ? (
              <PollMessage poll={message.poll} />
            ) : (
              <>
                {message.content && <p className="text-text-primary text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>}
                {message.attachments?.map((att, i) => (
                  <div key={i} className="mt-2 max-w-xs sm:max-w-sm">
                    {isImage(att.mimetype) ? (
                      <img src={att.url} alt={att.originalName} className="rounded-lg max-h-64 max-w-full object-contain bg-surface-700 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(att.url, '_blank')} />
                    ) : (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-surface-700 border border-surface-300 rounded-lg px-3 py-2 hover:bg-surface-500 transition-colors">
                        <Paperclip size={13} className="text-text-muted flex-shrink-0" />
                        <span className="text-sm text-brand-400 hover:underline truncate">{att.originalName}</span>
                        <span className="text-xs text-text-muted flex-shrink-0">{(att.size/1024).toFixed(0)}KB</span>
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
            {/* Reactions */}
            <MessageReactions messageId={message._id} reactions={message.reactions || []} />
          </>
        )}
      </div>

      {/* Message action menu */}
      {!message.deleted && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button onClick={() => setShowMenu(p => !p)}
              className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-400 transition-all">
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-40 bg-surface-800 border border-surface-300 rounded-xl shadow-xl p-1 min-w-[140px]"
                onMouseLeave={() => setShowMenu(false)}>
                {canDelete && (
                  <button onClick={deleteMessage} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-600 rounded-lg transition-colors">
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                {!canDelete && (
                  <button onClick={reportMessage} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-600 rounded-lg transition-colors">
                    <Flag size={13} /> Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
