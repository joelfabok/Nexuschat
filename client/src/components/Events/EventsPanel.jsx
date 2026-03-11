import { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Users, Video, Mic, X, Check } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import { getSocket } from '../../utils/socket';
import toast from 'react-hot-toast';

function CreateEventModal({ server, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', type: 'voice', scheduledAt: '', endsAt: '', streamUrl: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title || !form.scheduledAt) return toast.error('Title and date required');
    setLoading(true);
    try {
      const { data } = await api.post('/events', { ...form, serverId: server._id });
      onCreated(data);
      onClose();
    } catch { toast.error('Failed to create event'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 rounded-2xl w-full max-w-md border border-surface-300 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-surface-300">
          <h2 className="font-bold text-text-primary">Schedule Event</h2>
          <button onClick={onClose}><X size={18} className="text-text-muted hover:text-text-primary" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input className="input-base" placeholder="Event title" value={form.title} onChange={e => set('title', e.target.value)} />
          <textarea className="input-base resize-none h-20 text-sm" placeholder="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} />
          <select className="input-base" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="voice">🎙 Voice Session</option>
            <option value="watch">🎬 Watch Party</option>
            <option value="stream">📡 Live Stream</option>
          </select>
          {(form.type === 'watch' || form.type === 'stream') && (
            <input className="input-base" placeholder="YouTube/Twitch/Kick URL" value={form.streamUrl} onChange={e => set('streamUrl', e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Starts</label>
              <input type="datetime-local" className="input-base text-sm" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Ends (optional)</label>
              <input type="datetime-local" className="input-base text-sm" value={form.endsAt} onChange={e => set('endsAt', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-surface-300">
          <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
          <button onClick={submit} disabled={loading} className="flex-1 btn-primary">{loading ? 'Scheduling…' : 'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onRSVP }) {
  const { user } = useAuthStore();
  const myRsvp = event.attendees?.find(a => a.user?._id === user._id || a.user === user._id);
  const going = event.attendees?.filter(a => a.status === 'going').length || 0;
  const typeIcon = event.type === 'voice' ? <Mic size={12} /> : <Video size={12} />;
  const isLive = event.status === 'live';
  const isFut = isFuture(new Date(event.scheduledAt));

  return (
    <div className={`rounded-xl border p-3 transition-all ${isLive ? 'border-status-online/50 bg-status-online/5' : 'border-surface-300 bg-surface-700'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLive ? 'bg-status-online/20 text-status-online' : 'bg-surface-600 text-text-muted'}`}>
          {typeIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-text-primary text-sm truncate">{event.title}</p>
            {isLive && <span className="text-xs font-bold text-status-online bg-status-online/20 px-1.5 py-0.5 rounded-full animate-pulse">LIVE</span>}
          </div>
          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
            <Clock size={10} /> {format(new Date(event.scheduledAt), 'MMM d, h:mm a')}
            <span className="mx-1">·</span>
            <Users size={10} /> {going} going
          </p>
          {event.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{event.description}</p>}
        </div>
      </div>
      {isFut && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onRSVP(event._id, myRsvp?.status === 'going' ? 'not_going' : 'going')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${myRsvp?.status === 'going' ? 'bg-status-online/20 text-status-online border border-status-online/30' : 'bg-surface-500 text-text-secondary hover:bg-surface-400 border border-surface-300'}`}
          >
            {myRsvp?.status === 'going' ? <span className="flex items-center justify-center gap-1"><Check size={10}/> Going</span> : 'Going'}
          </button>
          <button
            onClick={() => onRSVP(event._id, 'maybe')}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${myRsvp?.status === 'maybe' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-surface-500 text-text-secondary hover:bg-surface-400 border border-surface-300'}`}
          >
            Maybe
          </button>
        </div>
      )}
    </div>
  );
}

export default function EventsPanel({ server, onClose }) {
  const { user } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const member = server?.members?.find(m => m.user?._id === user._id || m.user === user._id);
  const canCreate = member && ['admin', 'owner', 'moderator'].includes(member.role);

  useEffect(() => {
    if (!server?._id) return;
    api.get(`/events/server/${server._id}`).then(({ data }) => {
      setEvents(data);
      setLoading(false);
    }).catch(() => setLoading(false));

    const socket = getSocket();
    const onCreated = (ev) => setEvents(p => [ev, ...p]);
    const onUpdated = ({ eventId, ...rest }) => setEvents(p => p.map(e => e._id === eventId ? { ...e, ...rest } : e));
    const onLive = ({ eventId }) => setEvents(p => p.map(e => e._id === eventId ? { ...e, status: 'live' } : e));
    socket?.on('event:created', onCreated);
    socket?.on('event:updated', onUpdated);
    socket?.on('event:live', onLive);
    return () => { socket?.off('event:created', onCreated); socket?.off('event:updated', onUpdated); socket?.off('event:live', onLive); };
  }, [server?._id]);

  const handleRSVP = async (eventId, status) => {
    try {
      const { data } = await api.post(`/events/${eventId}/rsvp`, { status });
      setEvents(p => p.map(e => e._id === eventId ? { ...e, ...data } : e));
    } catch { toast.error('Failed to RSVP'); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-brand-400" />
          <span className="font-semibold text-text-primary text-sm">Events</span>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
              <Plus size={14} />
            </button>
          )}
          {onClose && <button onClick={onClose}><X size={16} className="text-text-muted hover:text-text-primary" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        {loading && <div className="text-center text-text-muted text-sm py-8">Loading events…</div>}
        {!loading && events.length === 0 && (
          <div className="text-center py-8">
            <Calendar size={32} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">No upcoming events</p>
            {canCreate && <button onClick={() => setShowCreate(true)} className="btn-primary text-xs px-4 py-2 mt-3">Schedule one</button>}
          </div>
        )}
        {events.map(ev => <EventCard key={ev._id} event={ev} onRSVP={handleRSVP} />)}
      </div>

      {showCreate && <CreateEventModal server={server} onClose={() => setShowCreate(false)} onCreated={ev => setEvents(p => [ev, ...p])} />}
    </div>
  );
}
