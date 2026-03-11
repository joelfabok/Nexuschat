import { MessageSquare, Users, Volume2, Shield } from 'lucide-react';

export default function WelcomeScreen({ onDMView }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a1f3a 0%, #12141f 60%)' }}>
      
      <div className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center mb-6 shadow-xl shadow-brand-600/30">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
          <path d="M6 8h20M6 16h14M6 24h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="26" cy="24" r="4" fill="#818cf8"/>
        </svg>
      </div>

      <h2 className="font-display font-bold text-3xl text-text-primary mb-2">Welcome to Nexus</h2>
      <p className="text-text-secondary max-w-md mb-10 leading-relaxed">
        Your private, secure space to chat with friends. Select a server and channel on the left, or start a direct message.
      </p>

      <div className="grid grid-cols-2 gap-4 max-w-lg w-full">
        {[
          { icon: MessageSquare, title: 'Real-time Chat', desc: 'Instant messaging with typing indicators' },
          { icon: Volume2, title: 'Voice Channels', desc: 'Crystal-clear voice powered by WebRTC' },
          { icon: Users, title: 'Direct Messages', desc: 'Private 1-on-1 conversations' },
          { icon: Shield, title: 'Secure by Design', desc: 'JWT auth, rate limiting, input validation' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-surface-700 border border-surface-300 rounded-xl p-4 text-left">
            <Icon size={20} className="text-brand-400 mb-2" />
            <h4 className="font-semibold text-text-primary text-sm mb-0.5">{title}</h4>
            <p className="text-text-muted text-xs">{desc}</p>
          </div>
        ))}
      </div>

      <button onClick={onDMView} className="mt-8 btn-primary px-6 py-2.5">
        Open Direct Messages
      </button>
    </div>
  );
}
