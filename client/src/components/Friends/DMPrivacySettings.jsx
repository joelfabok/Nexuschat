import { useState } from 'react';
import { Globe, Users, Ban, Check } from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';

const OPTIONS = [
  {
    value: 'everyone',
    icon: Globe,
    label: 'Everyone',
    description: 'Anyone can send you a direct message.',
    color: 'text-green-400',
    activeBg: 'border-green-500 bg-green-500/10',
  },
  {
    value: 'friends',
    icon: Users,
    label: 'Friends Only',
    description: 'Only users you are friends with can DM you.',
    color: 'text-indigo-400',
    activeBg: 'border-indigo-500 bg-indigo-500/10',
  },
  {
    value: 'nobody',
    icon: Ban,
    label: 'No One',
    description: 'Nobody can send you direct messages.',
    color: 'text-red-400',
    activeBg: 'border-red-500 bg-red-500/10',
  },
];

export default function DMPrivacySettings() {
  const { user } = useAuthStore();
  const [current, setCurrent] = useState(user?.dmPrivacy || 'everyone');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (value) => {
    if (value === current || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/dms/privacy', { dmPrivacy: value });
      setCurrent(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">DM Privacy</h3>
          <p className="text-xs text-gray-500 mt-0.5">Control who can send you direct messages</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      {OPTIONS.map(opt => {
        const Icon = opt.icon;
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => save(opt.value)}
            disabled={saving}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${isActive ? opt.activeBg : 'border-gray-700 hover:border-gray-600 bg-gray-750'}`}
          >
            <Icon size={20} className={isActive ? opt.color : 'text-gray-500'} />
            <div className="flex-1">
              <p className={`font-medium text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>{opt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </div>
            {isActive && <Check size={16} className={opt.color} />}
          </button>
        );
      })}
    </div>
  );
}
