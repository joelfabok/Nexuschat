import { useState, useEffect, useRef } from 'react';
import { Paperclip, Send, Edit2, Trash2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../context/authStore';
import { useProfile } from '../../context/ProfileContext';
import { getSocket } from '../../utils/socket';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  online: 'bg-status-online', idle: 'bg-status-idle',
  dnd: 'bg-status-dnd', offline: 'bg-status-offline',
};

export default function DMChat({ conversation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuthStore();
  const { openProfile } = useProfile() || {};

  const otherUser = conversation.participants?.find(p => (p._id || p) !== user._id);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation?._id) return;
    setMessages([]);
    setEditingId(null);
    setLoading(true);
    api.get(`/dms/${conversation._id}/messages`)
      .then(({ data }) => {
        setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false));
  }, [conversation._id]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = ({ conversationId, message }) => {
      if (conversationId !== conversation._id) return;
      setMessages(prev => {
        // avoid duplicate if we already added it optimistically
        if (prev.find(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const onEdited = ({ conversationId, message }) => {
      if (conversationId !== conversation._id) return;
      setMessages(prev => prev.map(m => m._id === message._id ? message : m));
    };

    const onDeleted = ({ conversationId, messageId }) => {
      if (conversationId !== conversation._id) return;
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true, content: '[Message deleted]' } : m));
    };

    socket.on('dm:message', onNew);
    socket.on('dm:message-edited', onEdited);
    socket.on('dm:message-deleted', onDeleted);
    return () => {
      socket.off('dm:message', onNew);
      socket.off('dm:message-edited', onEdited);
      socket.off('dm:message-deleted', onDeleted);
    };
  }, [conversation._id]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    try {
      await api.post(`/dms/${conversation._id}/messages`, { content });
    } catch (err) {
      toast.error('Failed to send');
      setInput(content);
    }
  };

  const saveEdit = async (messageId) => {
    if (!editContent.trim()) { setEditingId(null); return; }
    try {
      await api.patch(`/dms/${conversation._id}/messages/${messageId}`, { content: editContent });
      setEditingId(null);
    } catch (err) {
      toast.error('Failed to edit');
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await api.delete(`/dms/${conversation._id}/messages/${messageId}`);
    } catch (err) {
      toast.error('Failed to delete');
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

    setUploading(true);
    setUploadProgress(0);
    try {
      let fileData = null;
      for (let i = 0; i < totalChunks; i++) {
        const blob = file.slice(i * CHUNK, (i + 1) * CHUNK);
        const form = new FormData();
        form.append('chunk', blob);
        form.append('uploadId', uploadId);
        form.append('chunkIndex', i);
        form.append('totalChunks', totalChunks);
        form.append('filename', file.name);
        form.append('mimetype', file.type);
        form.append('totalSize', file.size);
        const { data } = await api.post('/files/chunk', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        if (i === totalChunks - 1) fileData = data;
      }
      await api.post(`/dms/${conversation._id}/messages`, { content: '', attachments: [fileData] });
      setUploadProgress(0);
    } catch (err) {
      api.delete(`/files/chunk/${uploadId}`).catch(() => {});
      toast.error('Upload failed');
      setUploadProgress(0);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!otherUser) return null;
  const initials = (otherUser.displayName || otherUser.username || '?').slice(0, 2).toUpperCase();
  const otherColor = otherUser.avatarColor || '#4f46e5';
  const myColor = user.avatarColor || '#4f46e5';
  const myInitials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-surface-300 shadow-sm flex-shrink-0">
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: otherColor }}>
            {otherUser.avatar
              ? <img src={otherUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              : initials}
          </div>
          <div className={`status-dot absolute -bottom-0.5 -right-0.5 ${STATUS_COLORS[otherUser.status || 'offline']}`} />
        </div>
        <span
          className="font-semibold text-text-primary cursor-pointer hover:underline"
          onClick={() => openProfile?.(otherUser._id)}
        >{otherUser.displayName || otherUser.username}</span>
        {otherUser.customStatus && (
          <span className="text-xs text-text-muted ml-1">— {otherUser.customStatus}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-0.5">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
              style={{ backgroundColor: otherColor }}>
              {initials}
            </div>
            <h4 className="font-display font-bold text-text-primary mb-1">{otherUser.displayName || otherUser.username}</h4>
            <p className="text-text-secondary text-sm">This is the beginning of your conversation.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const grouped = prev &&
            (prev.author?._id || prev.author) === (msg.author?._id || msg.author) &&
            (new Date(msg.createdAt) - new Date(prev.createdAt)) < 5 * 60 * 1000;
          const isOwn = (msg.author?._id || msg.author) === user._id;
          const authorColor = isOwn ? myColor : (msg.author?.avatarColor || otherColor);
          const authorInitials = isOwn ? myInitials : initials;
          const authorName = isOwn
            ? (user.displayName || user.username)
            : (msg.author?.displayName || msg.author?.username || otherUser.displayName || otherUser.username);

          return (
            <div key={msg._id} className={`group flex gap-3 ${grouped ? 'pt-0.5' : 'pt-4'}`}>
              {!grouped ? (
                <div
  style={{ backgroundColor: authorColor }}
  onClick={() => !isOwn && openProfile?.(msg.author?._id || otherUser._id)}
  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 ${!isOwn ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500' : ''} transition-all`}
>
                </div>
              ) : <div className="w-9 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                {!grouped && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      className="font-semibold text-text-primary text-sm cursor-pointer hover:underline"
                      onClick={() => !isOwn && openProfile?.(msg.author?._id || otherUser._id)}
                    >{authorName}</span>
                    <span className="text-xs text-text-muted">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                    {msg.edited && <span className="text-xs text-text-muted">(edited)</span>}
                  </div>
                )}

                {editingId === msg._id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      autoFocus
                      className="input-base text-sm flex-1 py-1"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(msg._id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button onClick={() => saveEdit(msg._id)} className="text-status-online hover:opacity-80"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                  </div>
                ) : (
                  <p className={`text-sm leading-relaxed break-words ${msg.deleted ? 'text-text-muted italic' : 'text-text-primary'}`}>
                    {msg.content}
                  </p>
                )}

                {msg.attachments?.map((att, idx) => (
                  <div key={idx} className="mt-2">
                    {att.mimetype?.startsWith('image/') ? (
                      <img
                        src={att.url} alt={att.originalName}
                        className="rounded-lg max-h-64 object-contain bg-surface-700 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(att.url, '_blank')}
                      />
                    ) : (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-surface-700 border border-surface-300 rounded-lg px-3 py-2 hover:bg-surface-500 transition-colors max-w-xs">
                        <Paperclip size={14} className="text-text-muted" />
                        <span className="text-sm text-brand-400 truncate">{att.originalName}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Hover actions */}
              {isOwn && !msg.deleted && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(msg._id); setEditContent(msg.content); }}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-400 transition-colors"
                    title="Edit"
                  ><Edit2 size={13} /></button>
                  <button
                    onClick={() => deleteMessage(msg._id)}
                    className="p-1 rounded text-text-muted hover:text-status-dnd hover:bg-surface-400 transition-colors"
                    title="Delete"
                  ><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        <div className="flex items-center gap-2 bg-surface-500 rounded-xl px-3 py-2 border border-surface-300 focus-within:border-brand-500/50 transition-colors">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0 p-1"
          >
            <Paperclip size={18} />
          </button>
          <input
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-sm focus:outline-none min-w-0"
            placeholder={`Message ${otherUser.displayName || otherUser.username}`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || uploading}
            className="text-text-muted hover:text-brand-400 disabled:opacity-30 transition-colors flex-shrink-0 p-1"
          >
            <Send size={18} />
          </button>
        </div>
        {uploading && (
          <div className="mt-2 px-1">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Uploading…</span><span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-surface-400 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
