import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👀'];

export default function MessageReactions({ messageId, reactions = [], compact = false }) {
  const { user } = useAuthStore();
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);
  const pickerRef = useRef(null);

  useEffect(() => { setLocalReactions(reactions); }, [reactions]);

  useEffect(() => {
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleReaction = async (emoji) => {
    setShowPicker(false);
    // Optimistic update
    setLocalReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing) {
        const hasVoted = existing.users?.some(u => u.toString() === user._id.toString());
        if (hasVoted) {
          const newUsers = existing.users.filter(u => u.toString() !== user._id.toString());
          if (newUsers.length === 0) return prev.filter(r => r.emoji !== emoji);
          return prev.map(r => r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers } : r);
        } else {
          return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, users: [...(r.users||[]), user._id] } : r);
        }
      }
      return [...prev, { emoji, count: 1, users: [user._id] }];
    });

    try {
      const { data } = await api.post(`/reactions/${messageId}/react`, { emoji });
      setLocalReactions(data.reactions);
    } catch (err) {
      setLocalReactions(reactions); // revert
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1 relative">
      {localReactions.filter(r => r.count > 0).map(r => {
        const hasVoted = r.users?.some(u => u.toString() === user._id.toString());
        return (
          <button
            key={r.emoji}
            onClick={() => toggleReaction(r.emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all active:scale-95 select-none ${
              hasVoted
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-surface-500 border-surface-300 text-text-secondary hover:border-brand-500/30'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        );
      })}

      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker(p => !p)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-surface-500 border border-surface-300 text-text-muted hover:text-text-primary hover:border-brand-500/30 transition-all opacity-0 group-hover:opacity-100"
        >
          <Smile size={12} />
        </button>

        {showPicker && (
          <div className="absolute bottom-8 left-0 z-50 bg-surface-800 border border-surface-300 rounded-xl p-2 shadow-xl flex gap-1.5">
            {QUICK_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => toggleReaction(e)}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-surface-600 active:scale-95 transition-all"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
