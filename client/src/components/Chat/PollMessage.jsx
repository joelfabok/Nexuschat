import { useState } from 'react';
import { BarChart2, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';

export default function PollMessage({ poll: initialPoll, onUpdate }) {
  const { user } = useAuthStore();
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);

  if (!poll) return null;

  const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
  const myVotes = poll.options
    .map((o, i) => ({ i, voted: o.votes?.some(v => v.toString() === user._id.toString()) }))
    .filter(o => o.voted)
    .map(o => o.i);
  const hasVoted = myVotes.length > 0;
  const isAuthor = poll.author?.toString() === user._id.toString() || poll.author?._id?.toString() === user._id.toString();
  const isClosed = poll.closed || (poll.endsAt && new Date(poll.endsAt) < new Date());

  const vote = async (idx) => {
    if (isClosed || voting) return;
    setVoting(true);
    try {
      const { data } = await api.post(`/polls/${poll._id}/vote`, { optionIndex: idx });
      setPoll(data);
      onUpdate?.(data);
    } catch (err) {}
    setVoting(false);
  };

  const closePoll = async () => {
    try {
      const { data } = await api.post(`/polls/${poll._id}/close`);
      setPoll(data);
    } catch (err) {}
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-surface-700 border border-surface-300 max-w-md">
      <div className="flex items-start gap-2 mb-3">
        <BarChart2 size={16} className="text-brand-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-sm">{poll.question}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            {poll.multiChoice && ' · multi-choice'}
            {isClosed && ' · closed'}
          </p>
        </div>
        {isClosed && <CheckCircle size={14} className="text-status-online flex-shrink-0" />}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = opt.votes?.length || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyVote = myVotes.includes(i);
          const showResults = hasVoted || isClosed;

          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={isClosed || voting}
              className={`w-full text-left rounded-lg overflow-hidden border transition-all ${
                isMyVote ? 'border-brand-500/60' : 'border-surface-300 hover:border-surface-200'
              } ${!isClosed ? 'active:scale-[0.99]' : ''}`}
            >
              <div className="relative px-3 py-2">
                {showResults && (
                  <div
                    className={`absolute inset-0 rounded-lg transition-all duration-500 ${isMyVote ? 'bg-brand-500/20' : 'bg-surface-500/40'}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-sm text-text-primary">{opt.text}</span>
                  {showResults && (
                    <span className="text-xs text-text-muted font-medium flex-shrink-0">{pct}%</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {poll.endsAt && !isClosed && (
        <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
          <Clock size={10} /> Ends {format(new Date(poll.endsAt), 'MMM d, h:mm a')}
        </p>
      )}
      {isAuthor && !isClosed && (
        <button onClick={closePoll} className="text-xs text-text-muted hover:text-red-400 mt-2 transition-colors">
          Close poll
        </button>
      )}
    </div>
  );
}
