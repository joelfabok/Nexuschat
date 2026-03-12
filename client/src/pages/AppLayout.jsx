import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Hash, Users } from 'lucide-react';
import NotificationBell from '../components/Notifications/NotificationBell';
import { ProfileProvider } from '../context/ProfileContext';
import FriendsPanel from '../components/Friends/FriendsPanel';
import ServerList from '../components/Layout/ServerList';
import ChannelSidebar from '../components/Layout/ChannelSidebar';
import ChatArea from '../components/Chat/ChatArea';
import DMSidebar from '../components/DM/DMSidebar';
import DMChat from '../components/DM/DMChat';
import UserPanel from '../components/Layout/UserPanel';
import WelcomeScreen from '../components/Layout/WelcomeScreen';
import { getSocket, waitForSocket } from '../utils/socket';
import toast from 'react-hot-toast';
import { useAuthStore } from '../context/authStore';
import { useUnreadStore } from '../context/unreadStore';
import api from '../utils/api';

// Mobile has 3 views stacked: 'servers' | 'sidebar' | 'chat'
export default function AppLayout() {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  const [view, setView] = useState('dms'); // 'dms' | 'server' | 'friends'
  const [mobileView, setMobileView] = useState('servers'); // 'servers' | 'sidebar' | 'chat'
  const { user } = useAuthStore();
  const { markChannelUnread, markChannelRead, markDMUnread, markDMRead } = useUnreadStore();

  useEffect(() => {
    fetchServers();
    const pendingInvite = sessionStorage.getItem('pendingInvite');
    if (pendingInvite) {
      sessionStorage.removeItem('pendingInvite');
      const code = pendingInvite.includes('/') ? pendingInvite.split('/').filter(Boolean).pop() : pendingInvite;
      api.post(`/servers/join/${code}`)
        .then(({ data }) => handleServerCreated(data))
        .catch(() => {});
    }
  }, []);

  // Global socket message listeners for unread counts
  useEffect(() => {
    const setup = async () => {
      const socket = await waitForSocket();
      const onNewMessage = (message) => {
        if (!activeChannel || activeChannel._id !== message.channel) markChannelUnread(message.channel);
      };
      const onDMMessage = ({ conversationId }) => {
        if (!activeDM || activeDM._id !== conversationId) markDMUnread(conversationId);
      };
      const onDMConversationDeleted = ({ conversationId }) => {
        if (activeDM && activeDM._id === conversationId) {
          setActiveDM(null);
          setView('dms');
          setMobileView('sidebar');
        }
        markDMRead(conversationId);
      };
      socket.on('message:new', onNewMessage);
      socket.on('dm:message', onDMMessage);
      socket.on('dm:conversation-deleted', onDMConversationDeleted);
      // Event reminders
      socket.on('event:reminder', ({ title, minsUntil }) => {
        toast(`⏰ ${title} starts in ${minsUntil} min!`, { duration: 8000, icon: '📅' });
      });
      socket.on('event:live', ({ title }) => {
        toast.success(`🔴 ${title} is now live!`, { duration: 6000 });
      });
      // Moderation events
      socket.on('moderation:kicked', ({ serverId, reason }) => {
        toast.error(`You were removed from a server${reason ? ': ' + reason : ''}`, { duration: 8000 });
      });
      socket.on('moderation:banned', ({ serverId, reason }) => {
        toast.error(`You were banned${reason ? ': ' + reason : ''}`, { duration: 10000 });
      });
      return () => {
        socket.off('message:new', onNewMessage);
        socket.off('dm:message', onDMMessage);
        socket.off('dm:conversation-deleted', onDMConversationDeleted);
      };
    };
    let cleanup = () => {};
    setup().then(fn => { if (fn) cleanup = fn; });
    return () => cleanup();
  }, [activeChannel?._id, activeDM?._id]);

  // Join server socket room
  useEffect(() => {
    if (!activeServer) return;
    const setup = async () => {
      const socket = await waitForSocket();
      socket.emit('server:join', { serverId: activeServer._id });
      return () => socket.emit('server:leave', { serverId: activeServer._id });
    };
    let cleanup = () => {};
    setup().then(fn => { if (fn) cleanup = fn; });
    return () => cleanup();
  }, [activeServer?._id]);

  const fetchServers = async () => {
    try {
      const { data } = await api.get('/servers');
      setServers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Failed to fetch servers', err); }
  };

  const handleServerSelect = (server) => {
    setActiveServer(server);
    setActiveDM(null);
    setView('server');
    const first = server.channels?.find(c => c.type === 'text');
    if (first) { setActiveChannel(first); markChannelRead(first._id); }
    setMobileView('sidebar');
  };

  const handleChannelSelect = (channel) => {
    setActiveChannel(channel);
    markChannelRead(channel._id);
    setMobileView('chat');
  };

  const handleDMSelect = (conv) => {
    setActiveDM(conv);
    setView('dms');
    markDMRead(conv._id);
    setMobileView('chat');
  };

  const handleDMDeleted = (conversationId) => {
    setActiveDM(prev => (prev?._id === conversationId ? null : prev));
    markDMRead(conversationId);
    if (activeDM?._id === conversationId) {
      setView('dms');
      setMobileView('sidebar');
    }
  };

  const handleDMView = () => {
    setView('dms');
    setActiveServer(null);
    setActiveChannel(null);
    setMobileView('sidebar');
  };

  const handleServerCreated = (server) => {
    setServers(prev => prev.find(s => s._id === server._id) ? prev : [...prev, server]);
    handleServerSelect(server);
  };

  const handleServerUpdate = (updated) => {
    setServers(prev => prev.map(s => s._id === updated._id ? updated : s));
    setActiveServer(updated);
    if (activeChannel) {
      const ch = updated.channels?.find(c => c._id === activeChannel._id);
      if (ch) setActiveChannel(ch);
    }
  };

  const handleServerDelete = (serverId) => {
    setServers(prev => prev.filter(s => s._id !== serverId));
    if (activeServer?._id === serverId) {
      setActiveServer(null); setActiveChannel(null); setView('dms'); setMobileView('servers');
    }
  };

  // ── Shared content blocks ────────────────────────────────────────────────
  const sidebarContent = view === 'dms'
    ? <DMSidebar activeDM={activeDM} onDMSelect={handleDMSelect} onDMDelete={handleDMDeleted} />
    : view === 'friends'
    ? <FriendsPanel onStartDM={handleDMSelect} />
    : <ChannelSidebar server={activeServer} activeChannel={activeChannel}
        onChannelSelect={handleChannelSelect} onServerUpdate={handleServerUpdate}
        onServerDelete={handleServerDelete} />;

  const chatContent = view === 'dms' && activeDM
    ? <DMChat conversation={activeDM} onRead={() => markDMRead(activeDM._id)} />
    : view === 'server' && activeChannel
    ? <ChatArea channel={activeChannel} server={activeServer} />
    : view === 'friends'
    ? <div className="h-full flex items-center justify-center text-gray-400">Select a friend to see options in the left panel.&#8203;</div>
    : <WelcomeScreen onDMView={handleDMView} />;

  const chatTitle = view === 'dms' && activeDM
    ? activeDM.participants?.find(p => (p._id || p) !== user._id)?.displayName || 'DM'
    : activeChannel ? `# ${activeChannel.name}` : '';

  const [showFriends, setShowFriends] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);

  // ── DESKTOP (≥ md) ──────────────────────────────────────────────────────
  const desktopLayout = (
    <div className="hidden md:flex h-screen w-screen overflow-hidden bg-surface-900">
      <ServerList servers={servers} activeServer={activeServer}
        onServerSelect={handleServerSelect} onDMView={handleDMView} onFriendsView={() => setView('friends')}
        onServerCreated={handleServerCreated} isDMView={view === 'dms'} isFriendsView={view === 'friends'} />
      <div className="w-60 flex-shrink-0 flex flex-col bg-surface-800">
        {sidebarContent}
        <div className="flex items-center gap-1 px-2 pb-1">
          <NotificationBell />
        </div>
        <UserPanel />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-surface-600">
        {chatContent}
      </div>
    </div>
  );

  // ── MOBILE (< md) — safe-area-aware, no content under notch/home bar ────
  const panels = ['servers', 'sidebar', 'chat'];
  const panelIdx = panels.indexOf(mobileView);

  const mobileLayout = (
    <div className="md:hidden flex flex-col w-screen overflow-hidden bg-surface-900"
      style={{ height: '100dvh' }}>
      <div className="flex-1 relative overflow-hidden">

        {/* Panel 0: server list */}
        <div className={`absolute inset-0 flex transition-transform duration-300 ease-in-out ${panelIdx === 0 ? 'translate-x-0' : 'pointer-events-none -translate-x-full'}`}>
          <div className="w-[72px] flex-shrink-0 flex flex-col items-center bg-surface-900 border-r border-surface-300 overflow-y-auto scrollbar-hide"
            style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
            <ServerList servers={servers} activeServer={activeServer}
              onServerSelect={handleServerSelect} onDMView={handleDMView}
              onServerCreated={handleServerCreated} isDMView={view === 'dms'} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center bg-surface-800 gap-4 p-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center">
              <MessageSquare size={28} className="text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-text-primary font-semibold mb-1">Welcome to Nexus</p>
              <p className="text-text-muted text-sm">Tap a server or open messages</p>
            </div>
            <button onClick={handleDMView} className="btn-primary text-sm px-6 py-3">Open Messages</button>
          </div>
        </div>

        {/* Panel 1: sidebar */}
        <div className={`absolute inset-0 flex flex-col bg-surface-800 transition-transform duration-300 ease-in-out ${panelIdx === 1 ? 'translate-x-0' : panelIdx < 1 ? 'pointer-events-none translate-x-full' : 'pointer-events-none -translate-x-full'}`}>
          <div className="flex items-center px-4 bg-surface-900 border-b border-surface-300 flex-shrink-0 gap-2"
            style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))', paddingBottom: '14px' }}>
            <button onClick={() => setMobileView('servers')}
              className="w-11 h-11 flex items-center justify-center text-text-muted active:text-text-primary rounded-xl -ml-1">
              <ArrowLeft size={24} />
            </button>
            <span className="font-semibold text-text-primary text-base flex-1 truncate">
              {view === 'dms' ? 'Messages' : activeServer?.name || 'Channels'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">{sidebarContent}</div>
          <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <UserPanel />
          </div>
        </div>

        {/* Panel 2: chat */}
        <div className={`absolute inset-0 flex flex-col bg-surface-600 transition-transform duration-300 ease-in-out ${panelIdx === 2 ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}>
          <div className="flex items-center px-4 bg-surface-800 border-b border-surface-300 flex-shrink-0 gap-2"
            style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))', paddingBottom: '14px' }}>
            <button onClick={() => setMobileView('sidebar')}
              className="w-11 h-11 flex items-center justify-center text-text-muted active:text-text-primary rounded-xl -ml-1 flex-shrink-0">
              <ArrowLeft size={24} />
            </button>
            <span className="font-semibold text-text-primary text-base truncate flex-1">{chatTitle}</span>
          </div>
          <div className="flex-1 overflow-hidden">{chatContent}</div>
        </div>

      </div>
    </div>
  );

  return (
    <ProfileProvider onStartDM={handleDMSelect}>
      {mobileLayout}
      {desktopLayout}
    </ProfileProvider>
  );
}
