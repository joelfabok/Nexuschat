import { useState, useEffect } from 'react';
import { BarChart2, Users, MessageSquare, TrendingUp, Hash } from 'lucide-react';
import api from '../../utils/api';

export default function AnalyticsDashboard({ server }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!server?._id) return;
    api.get(`/analytics/${server._id}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [server?._id]);

  if (loading) return <div className="p-6 text-center text-text-muted text-sm">Loading analytics…</div>;
  if (!data) return <div className="p-6 text-center text-text-muted text-sm">Failed to load analytics</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={18} className="text-brand-400" />
        <h3 className="font-bold text-text-primary">Analytics</h3>
        <span className="text-xs text-text-muted">Last 7 days</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Members', value: data.totalMembers, icon: <Users size={14} />, color: 'text-brand-400' },
          { label: 'Messages (24h)', value: data.messages24h, icon: <MessageSquare size={14} />, color: 'text-status-online' },
          { label: 'Messages (7d)', value: data.messages7d, icon: <TrendingUp size={14} />, color: 'text-yellow-400' },
          { label: 'Online', value: data.onlineCount, icon: <Users size={14} />, color: 'text-status-online' },
        ].map(stat => (
          <div key={stat.label} className="p-3 rounded-xl bg-surface-700 border border-surface-300">
            <div className={`flex items-center gap-1.5 text-xs mb-1 ${stat.color}`}>
              {stat.icon}{stat.label}
            </div>
            <p className="text-2xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Top channels */}
      {data.topChannels?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Most Active Channels</p>
          <div className="space-y-2">
            {data.topChannels.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-700 border border-surface-300">
                <Hash size={14} className="text-text-muted flex-shrink-0" />
                <span className="text-sm text-text-primary flex-1 truncate">{c.channel?.name || 'Unknown'}</span>
                <span className="text-xs font-medium text-brand-400">{c.messageCount} msgs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top members */}
      {data.topMembers?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Most Active Members</p>
          <div className="space-y-2">
            {data.topMembers.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-700 border border-surface-300">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: m.user?.avatarColor || '#4f46e5' }}>
                  {(m.user?.displayName || m.user?.username || '?').slice(0,2).toUpperCase()}
                </div>
                <span className="text-sm text-text-primary flex-1 truncate">{m.user?.displayName || m.user?.username}</span>
                <span className="text-xs font-medium text-brand-400">{m.messageCount} msgs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
