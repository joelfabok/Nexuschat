import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function CreatePollModal({ channel, server, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiChoice, setMultiChoice] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);

  const addOption = () => { if (options.length < 10) setOptions(p => [...p, '']); };
  const removeOption = (i) => { if (options.length > 2) setOptions(p => p.filter((_, idx) => idx !== i)); };
  const updateOption = (i, val) => setOptions(p => p.map((o, idx) => idx === i ? val : o));

  const submit = async () => {
    const filled = options.filter(o => o.trim());
    if (!question.trim()) return toast.error('Question required');
    if (filled.length < 2) return toast.error('At least 2 options required');
    setLoading(true);
    try {
      await api.post('/polls', {
        question: question.trim(),
        options: filled,
        channelId: channel._id,
        serverId: server._id,
        multiChoice,
        endsAt: endsAt || null,
      });
      onClose();
    } catch (err) {
      toast.error('Failed to create poll');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 rounded-2xl w-full max-w-md shadow-2xl border border-surface-300">
        <div className="flex items-center justify-between p-4 border-b border-surface-300">
          <h2 className="font-bold text-text-primary">Create Poll</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Question</label>
            <input
              className="input-base"
              placeholder="What do you want to ask?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Options</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input-base flex-1"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    maxLength={200}
                  />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)}
                      className="w-9 h-9 flex items-center justify-center text-text-muted hover:text-red-400 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button onClick={addOption}
                className="mt-2 flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                <Plus size={14} /> Add option
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={multiChoice} onChange={e => setMultiChoice(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500" />
              <span className="text-sm text-text-secondary">Allow multiple answers</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">End time (optional)</label>
            <input type="datetime-local" className="input-base" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-surface-300">
          <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
          <button onClick={submit} disabled={loading} className="flex-1 btn-primary">
            {loading ? 'Creating…' : 'Create Poll'}
          </button>
        </div>
      </div>
    </div>
  );
}
