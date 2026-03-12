import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Mic, MicOff, PhoneOff, Users, Headphones, Monitor, MonitorOff, Youtube, X, Play, Pause, Maximize2 } from 'lucide-react';
import { useAuthStore } from '../../context/authStore';
import { getSocket, waitForSocket } from '../../utils/socket';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Extract YouTube video ID from any YouTube URL
function extractYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function ParticipantTile({ participant, isSelf, audioRef }) {
  const initials = (participant.displayName || participant.username || '?').slice(0, 2).toUpperCase();
  return (
    <div className={`flex flex-col items-center gap-2 bg-surface-700 border rounded-xl p-4 transition-all duration-150 ${
      participant.speaking ? 'border-status-online shadow-lg shadow-status-online/20' : 'border-surface-300'
    }`}>
      <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white transition-all duration-150 ${
        participant.speaking ? 'ring-4 ring-status-online ring-offset-2 ring-offset-surface-700' : ''
      }`} style={{ backgroundColor: participant.avatarColor || '#4f46e5' }}>
        {initials}
        {participant.muted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-status-dnd flex items-center justify-center border-2 border-surface-700">
            <MicOff size={10} className="text-white" />
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-text-primary text-center truncate w-full">
        {participant.displayName || participant.username}
        {isSelf && <span className="text-text-muted font-normal"> (you)</span>}
      </p>
      {participant.screenSharing && (
        <span className="text-xs text-brand-400 flex items-center gap-1"><Monitor size={10} /> Sharing</span>
      )}
      {!isSelf && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
}

function WatchParty({ channelId, onClose }) {
  const [url, setUrl] = useState('');
  const [activeParty, setActiveParty] = useState(null);
  const [showInput, setShowInput] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef(null);
  const { user } = useAuthStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Ask server for current state when joining
    socket.emit('watch:sync-request', { channelId });

    const onStarted = ({ url, type, hostId, displayName }) => {
      setActiveParty({ url, type, hostId, displayName });
      if (hostId !== user._id) toast(`${displayName} started a watch party!`);
    };
    const onStopped = () => { setActiveParty(null); setShowInput(false); };
    const onSync = ({ url, type, hostId }) => { if (url) setActiveParty({ url, type, hostId }); };
    const onPlay = () => { /* YouTube API syncs via postMessage if needed */ };
    const onPause = () => {};
    const onSeek = () => {};

    socket.on('watch:started', onStarted);
    socket.on('watch:stopped', onStopped);
    socket.on('watch:sync', onSync);
    socket.on('watch:play', onPlay);
    socket.on('watch:pause', onPause);
    socket.on('watch:seek', onSeek);

    return () => {
      socket.off('watch:started', onStarted);
      socket.off('watch:stopped', onStopped);
      socket.off('watch:sync', onSync);
      socket.off('watch:play', onPlay);
      socket.off('watch:pause', onPause);
      socket.off('watch:seek', onSeek);
    };
  }, [channelId]);

  const startParty = () => {
    if (!url.trim()) return;
    const ytId = extractYouTubeId(url.trim());
    const type = ytId ? 'youtube' : 'url';
    const finalUrl = ytId ? `https://www.youtube.com/embed/${ytId}?enablejsapi=1&autoplay=1&rel=0` : url.trim();
    getSocket()?.emit('watch:start', { channelId, url: finalUrl, type, rawUrl: url.trim() });
    setActiveParty({ url: finalUrl, type, hostId: user._id, displayName: user.displayName || user.username });
    setShowInput(false);
    setUrl('');
  };

  const stopParty = () => {
    getSocket()?.emit('watch:stop', { channelId });
    setActiveParty(null);
  };

  if (!activeParty && !showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-surface-600 border border-surface-300 text-text-secondary hover:text-text-primary hover:border-brand-500 transition-all"
      >
        <Youtube size={15} className="text-red-500" /> Watch Together
      </button>
    );
  }

  if (showInput && !activeParty) {
    return (
      <div className="flex items-center gap-2 flex-1 max-w-lg">
        <input
          autoFocus
          className="input-base text-sm flex-1 py-1.5"
          placeholder="Paste YouTube URL…"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && startParty()}
        />
        <button onClick={startParty} disabled={!url.trim()} className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 flex-shrink-0">Start</button>
        <button onClick={() => setShowInput(false)} className="text-text-muted hover:text-text-primary flex-shrink-0"><X size={16} /></button>
      </div>
    );
  }

  // Active party
  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : 'w-full rounded-xl overflow-hidden border border-surface-300 bg-black'}`}>
      {/* Theater bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-900/90 backdrop-blur-sm flex-shrink-0">
        <Youtube size={14} className="text-red-500 flex-shrink-0" />
        <span className="text-xs text-text-secondary truncate flex-1">Watch Party</span>
        <button onClick={() => setFullscreen(!fullscreen)} className="text-text-muted hover:text-text-primary p-1"><Maximize2 size={14} /></button>
        {activeParty.hostId === user._id && (
          <button onClick={stopParty} className="text-status-dnd hover:text-red-400 text-xs flex items-center gap-1 p-1">
            <X size={14} /> End
          </button>
        )}
      </div>
      <div className={`${fullscreen ? 'flex-1' : 'aspect-video'} w-full`}>
        <iframe
          ref={iframeRef}
          src={activeParty.url}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title="Watch Party"
        />
      </div>
    </div>
  );
}

function SelfScreenSharePreview({ stream }) {
  if (!stream) return null;
  return (
    <div className="w-full rounded-xl overflow-hidden border border-brand-500/50 bg-black relative">
      <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
        <Monitor size={12} className="text-brand-400" />
        <span className="text-xs text-white font-medium">You are sharing your screen</span>
      </div>
      <video
        autoPlay
        playsInline
        muted
        className="w-full aspect-video object-contain"
        ref={el => { if (el && stream) el.srcObject = stream; }}
      />
    </div>
  );
}

function ScreenShareViewer({ streams }) {
  if (!streams.length) return null;
  const { displayName, stream } = streams[0];

  return (
    <div className="w-full rounded-xl overflow-hidden border border-brand-500/50 bg-black relative">
      <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5">
        <Monitor size={12} className="text-brand-400" />
        <span className="text-xs text-white font-medium">{displayName} is sharing their screen</span>
      </div>
      <video
        autoPlay
        playsInline
        className="w-full aspect-video object-contain"
        ref={el => { if (el && stream) el.srcObject = stream; }}
      />
    </div>
  );
}

export default function VoiceChannel({ channel }) {
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [screenStreams, setScreenStreams] = useState([]); // incoming screen shares
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const screenPCsRef = useRef({});
  const audioElementsRef = useRef({});
  const audioAnalysersRef = useRef({});
  const speakingIntervalRef = useRef(null);
  const { user } = useAuthStore();

  const startSpeakingDetection = useCallback((stream, userId) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioAnalysersRef.current[userId] = { analyser, ctx };
    } catch (_) {}
  }, []);

  const checkSpeaking = useCallback(() => {
    const data = new Uint8Array(256);
    Object.entries(audioAnalysersRef.current).forEach(([userId, { analyser }]) => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, speaking: avg > 10 } : p));
    });
  }, []);

  const createPeerConnection = useCallback((targetUserId) => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('voice:ice-candidate', { channelId: channel._id, targetUserId, candidate });
    };

    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;
      const el = audioElementsRef.current[targetUserId];
      if (el) el.srcObject = stream;
      startSpeakingDetection(stream, targetUserId);
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setParticipants(prev => prev.filter(p => p.userId !== targetUserId));
        peerConnectionsRef.current[targetUserId]?.close();
        delete peerConnectionsRef.current[targetUserId];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  }, [channel._id, startSpeakingDetection]);

  // Screen share peer connection (sending)
  const createScreenSharePC = useCallback((targetUserId) => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('voice:screen-ice-candidate', { channelId: channel._id, targetUserId, candidate });
    };

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => pc.addTrack(track, screenStreamRef.current));
    }

    screenPCsRef.current[targetUserId] = pc;
    return pc;
  }, [channel._id]);

  const leaveChannel = useCallback(() => {
    const socket = getSocket();
    socket?.emit('voice:leave', { channelId: channel._id });
    if (screenSharing) {
      socket?.emit('voice:screen-share-stop', { channelId: channel._id });
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current?._gainCtx?.close().catch(() => {});
    localStreamRef.current = null;
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    Object.values(screenPCsRef.current).forEach(pc => pc.close());
    screenPCsRef.current = {};
    Object.values(audioAnalysersRef.current).forEach(({ ctx }) => ctx.close().catch(() => {}));
    audioAnalysersRef.current = {};
    clearInterval(speakingIntervalRef.current);
    setJoined(false);
    setParticipants([]);
    setMuted(false);
    setDeafened(false);
    setScreenSharing(false);
    setScreenStreams([]);
  }, [channel._id, screenSharing]);

  const joinChannel = async () => {
    // iOS PWA fix: AudioContext must be created synchronously inside the tap handler
    // before any await, otherwise iOS blocks it as "not from user gesture"
    let iosAudioCtx = null;
    try { iosAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}

    try {
      // Load saved settings
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('nexus_audio_settings') || '{}'); } catch (_) {}

      // Resume the AudioContext we created synchronously (iOS requires this)
      if (iosAudioCtx?.state === 'suspended') {
        await iosAudioCtx.resume();
      }

      const audioConstraints = {
        echoCancellation: saved.echoCancellation ?? true,
        noiseSuppression: saved.noiseSuppression ?? true,
        autoGainControl: saved.autoGain ?? true,
        ...(saved.selectedMic && saved.selectedMic !== 'default' ? { deviceId: { ideal: saved.selectedMic } } : {}),
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });

      // Apply input volume via GainNode — reuse the AudioContext we already created
      let finalStream = stream;
      try {
        const ctx = iosAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = (saved.inputVolume ?? 100) / 100;
        const dest = ctx.createMediaStreamDestination();
        src.connect(gainNode);
        gainNode.connect(dest);
        finalStream = dest.stream;
        finalStream._gainCtx = ctx;
        iosAudioCtx = null; // ctx is now owned by finalStream, don't close it below
      } catch (_) { /* fallback to raw stream */ }

      localStreamRef.current = finalStream;
      startSpeakingDetection(stream, user._id);

      const socket = await waitForSocket();
      socket.emit('voice:join', { channelId: channel._id });

      setJoined(true);
      setParticipants([{
        userId: user._id, username: user.username,
        displayName: user.displayName || user.username,
        avatarColor: user.avatarColor || '#4f46e5',
        muted: false, speaking: false, screenSharing: false,
      }]);
      speakingIntervalRef.current = setInterval(checkSpeaking, 100);
      toast.success(`Joined ${channel.name}`);
    } catch (err) {
      // Clean up the pre-created AudioContext if we didn't use it
      iosAudioCtx?.close().catch(() => {});
      if (err.name === 'NotAllowedError') toast.error('Mic access denied — allow it in your browser/phone settings');
      else if (err.name === 'NotFoundError') toast.error('No microphone found');
      else { console.error('Voice join error:', err); toast.error('Failed to join voice: ' + err.message); }
    }
  };

  const toggleScreenShare = async () => {
    const socket = getSocket();
    if (screenSharing) {
      socket?.emit('voice:screen-share-stop', { channelId: channel._id });
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      Object.values(screenPCsRef.current).forEach(pc => pc.close());
      screenPCsRef.current = {};
      setScreenSharing(false);
      setLocalScreenStream(null);
      setParticipants(prev => prev.map(p => p.userId === user._id ? { ...p, screenSharing: false } : p));
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setLocalScreenStream(stream);
        stream.getVideoTracks()[0].onended = () => toggleScreenShare();
        socket?.emit('voice:screen-share-start', { channelId: channel._id });
        setScreenSharing(true);
        setParticipants(prev => prev.map(p => p.userId === user._id ? { ...p, screenSharing: true } : p));

        // Create offers to all existing participants
        participants.filter(p => p.userId !== user._id).forEach(async p => {
          const pc = createScreenSharePC(p.userId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('voice:screen-offer', { channelId: channel._id, targetUserId: p.userId, offer });
        });
      } catch (err) {
        if (err.name !== 'NotAllowedError') toast.error('Could not start screen share');
      }
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onVoiceUsers = async ({ channelId, users }) => {
      if (channelId !== channel._id) return;
      for (const vu of users) {
        const pc = createPeerConnection(vu.userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice:offer', { channelId, targetUserId: vu.userId, offer });
        setParticipants(prev =>
          prev.find(p => p.userId === vu.userId) ? prev :
          [...prev, { userId: vu.userId, username: vu.username, displayName: vu.displayName || vu.username, avatarColor: vu.avatarColor || '#4f46e5', muted: vu.muted, speaking: false, screenSharing: vu.screenSharing }]
        );
      }
    };

    const onUserJoined = ({ channelId, user: u }) => {
      if (channelId !== channel._id) return;
      setParticipants(prev =>
        prev.find(p => p.userId === u.userId) ? prev :
        [...prev, { userId: u.userId, username: u.username, displayName: u.displayName || u.username, avatarColor: u.avatarColor || '#4f46e5', muted: false, speaking: false, screenSharing: false }]
      );
    };

    const onUserLeft = ({ channelId, userId }) => {
      if (channelId !== channel._id) return;
      peerConnectionsRef.current[userId]?.close();
      delete peerConnectionsRef.current[userId];
      audioAnalysersRef.current[userId]?.ctx.close().catch(() => {});
      delete audioAnalysersRef.current[userId];
      // Remove their screen share stream if any
      setScreenStreams(prev => prev.filter(s => s.userId !== userId));
      setParticipants(prev => prev.filter(p => p.userId !== userId));
    };

    const onOffer = async ({ channelId, fromUserId, offer }) => {
      if (channelId !== channel._id) return;
      let pc = peerConnectionsRef.current[fromUserId] || createPeerConnection(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:answer', { channelId, targetUserId: fromUserId, answer });
    };

    const onAnswer = async ({ fromUserId, answer }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc?.signalingState === 'have-local-offer') await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIce = async ({ fromUserId, candidate }) => {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    };

    const onStateChange = ({ channelId, userId, muted: isMuted }) => {
      if (channelId !== channel._id) return;
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, muted: isMuted } : p));
    };

    // Screen share: someone else started sharing — set up a receiver PC
    const onScreenShareStarted = async ({ channelId, userId, username }) => {
      if (channelId !== channel._id || userId === user._id) return;
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, screenSharing: true } : p));
    };

    const onScreenShareStopped = ({ channelId, userId }) => {
      if (channelId !== channel._id) return;
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, screenSharing: false } : p));
      setScreenStreams(prev => prev.filter(s => s.userId !== userId));
      screenPCsRef.current[userId]?.close();
      delete screenPCsRef.current[userId];
    };

    // Receive screen share offer (viewer side)
    const onScreenOffer = async ({ channelId, fromUserId, offer }) => {
      if (channelId !== channel._id) return;
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('voice:screen-ice-candidate', { channelId, targetUserId: fromUserId, candidate });
      };

      pc.ontrack = ({ streams }) => {
        const stream = streams[0];
        if (!stream) return;
        const sharer = participants.find(p => p.userId === fromUserId);
        setScreenStreams(prev => {
          const filtered = prev.filter(s => s.userId !== fromUserId);
          return [...filtered, { userId: fromUserId, displayName: sharer?.displayName || 'Someone', stream }];
        });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:screen-answer', { channelId, targetUserId: fromUserId, answer });
      screenPCsRef.current[fromUserId] = pc;
    };

    const onScreenAnswer = async ({ fromUserId, answer }) => {
      const pc = screenPCsRef.current[fromUserId];
      if (pc?.signalingState === 'have-local-offer') await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onScreenIce = async ({ fromUserId, candidate }) => {
      const pc = screenPCsRef.current[fromUserId];
      if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    };

    socket.on('voice:users', onVoiceUsers);
    socket.on('voice:user-joined', onUserJoined);
    socket.on('voice:user-left', onUserLeft);
    socket.on('voice:offer', onOffer);
    socket.on('voice:answer', onAnswer);
    socket.on('voice:ice-candidate', onIce);
    socket.on('voice:state-change', onStateChange);
    socket.on('voice:screen-share-started', onScreenShareStarted);
    socket.on('voice:screen-share-stopped', onScreenShareStopped);
    socket.on('voice:screen-offer', onScreenOffer);
    socket.on('voice:screen-answer', onScreenAnswer);
    socket.on('voice:screen-ice-candidate', onScreenIce);

    return () => {
      socket.off('voice:users', onVoiceUsers);
      socket.off('voice:user-joined', onUserJoined);
      socket.off('voice:user-left', onUserLeft);
      socket.off('voice:offer', onOffer);
      socket.off('voice:answer', onAnswer);
      socket.off('voice:ice-candidate', onIce);
      socket.off('voice:state-change', onStateChange);
      socket.off('voice:screen-share-started', onScreenShareStarted);
      socket.off('voice:screen-share-stopped', onScreenShareStopped);
      socket.off('voice:screen-offer', onScreenOffer);
      socket.off('voice:screen-answer', onScreenAnswer);
      socket.off('voice:screen-ice-candidate', onScreenIce);
    };
  }, [channel._id, createPeerConnection, createScreenSharePC, participants]);

  useEffect(() => () => { if (joined) leaveChannel(); }, [channel._id]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks?.length) tracks[0].enabled = muted;
    const newMuted = !muted;
    setMuted(newMuted);
    setParticipants(prev => prev.map(p => p.userId === user._id ? { ...p, muted: newMuted, speaking: newMuted ? false : p.speaking } : p));
    getSocket()?.emit('voice:toggle-mute', { channelId: channel._id, muted: newMuted });
  };

  const toggleDeafen = () => {
    const newDeafened = !deafened;
    setDeafened(newDeafened);
    Object.values(audioElementsRef.current).forEach(el => { el.muted = newDeafened; });
  };

  // ── JOIN SCREEN ────────────────────────────────────────────────────────────
  if (!joined) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center animate-fade-in"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
        <div className="w-20 h-20 rounded-full bg-surface-600 border-2 border-surface-300 flex items-center justify-center mb-4">
          <Volume2 size={36} className="text-text-muted" />
        </div>
        <h4 className="font-display font-bold text-text-primary text-xl mb-1">{channel.name}</h4>
        <p className="text-text-muted text-sm mb-8">Voice channel · your mic activates on join</p>
        <button onClick={joinChannel}
          className="btn-primary px-10 py-4 text-base flex items-center gap-2 rounded-2xl"
          style={{ minHeight: '56px' }}>
          <Mic size={20} /> Join Voice
        </button>
      </div>
    );
  }

  // ── ACTIVE CALL ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-surface-300 flex-shrink-0">
        <Volume2 size={18} className="text-text-muted" />
        <h3 className="font-semibold text-text-primary text-sm">{channel.name}</h3>
        <span className="px-2 py-0.5 rounded-full bg-status-online/20 text-status-online text-xs font-medium">Live</span>
        <span className="ml-auto text-xs text-text-muted flex items-center gap-1"><Users size={12} /> {participants.length}</span>
        <div className="ml-2">
          <WatchParty channelId={channel._id} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {localScreenStream && <SelfScreenSharePreview stream={localScreenStream} />}
        {screenStreams.length > 0 && <ScreenShareViewer streams={screenStreams} />}
        <div className={`grid gap-3 ${
          participants.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' :
          participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
          {participants.map(p => (
            <ParticipantTile
              key={p.userId} participant={p} isSelf={p.userId === user._id}
              audioRef={el => { if (el && p.userId !== user._id) audioElementsRef.current[p.userId] = el; }}
            />
          ))}
        </div>
      </div>

      {/* Controls bar — safe-area-aware so home indicator never covers buttons */}
      <div className="flex items-center justify-center gap-3 px-4 border-t border-surface-300 bg-surface-800 flex-shrink-0"
        style={{ paddingTop: '12px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>

        <button onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${muted ? 'bg-status-dnd text-white' : 'bg-surface-500 text-text-secondary active:bg-surface-400'}`}>
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button onClick={toggleDeafen}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${deafened ? 'bg-status-dnd text-white' : 'bg-surface-500 text-text-secondary active:bg-surface-400'}`}>
          <Headphones size={20} />
        </button>

        <button onClick={toggleScreenShare}
          className={`w-12 h-12 rounded-full items-center justify-center transition-all hidden sm:flex ${screenSharing ? 'bg-brand-500 text-white' : 'bg-surface-500 text-text-secondary active:bg-surface-400'}`}>
          {screenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        <button onClick={leaveChannel}
          className="w-12 h-12 rounded-full bg-status-dnd active:bg-red-700 text-white flex items-center justify-center transition-colors">
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
