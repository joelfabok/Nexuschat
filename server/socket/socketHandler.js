import { authenticateSocket } from '../middleware/auth.js';
import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import User from '../models/User.js';

// In-memory state
const onlineUsers = new Map();    // userId -> socketId
const voiceChannels = new Map();  // channelId -> Map of userId -> { userId, socketId, username, displayName, avatarColor, muted, deafened, screenSharing }
const typingUsers = new Map();    // channelId -> Map of userId -> timeout

// Helper: broadcast current voice channel members to a server room
function broadcastVoiceState(io, channelId) {
  const vcUsers = voiceChannels.get(channelId);
  const members = vcUsers ? Array.from(vcUsers.values()) : [];
  io.to(`server_voice:${channelId}`).emit('voice:channel-members', { channelId, members });
}

export const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`✅ Connected: ${user.username} (${socket.id})`);

    onlineUsers.set(user._id.toString(), socket.id);
    socket.join(`user:${user._id}`);
    await user.updateOne({ status: 'online', lastSeen: new Date() });
    broadcastUserStatus(io, user._id.toString(), 'online');

    // ── Server rooms ──────────────────────────────────────────────────
    socket.on('server:join', async ({ serverId }) => {
      try {
        const server = await Server.findById(serverId).populate('channels');
        if (!server) return;
        if (!server.members.some(m => m.user.equals(user._id))) return;

        socket.join(`server:${serverId}`);
        server.channels.forEach(ch => {
          socket.join(`channel:${ch._id}`);
          socket.join(`server_voice:${ch._id}`); // for voice member list updates
        });

        // Send current voice state for all channels in this server
        server.channels.forEach(ch => {
          const vcUsers = voiceChannels.get(ch._id.toString());
          if (vcUsers) {
            socket.emit('voice:channel-members', {
              channelId: ch._id.toString(),
              members: Array.from(vcUsers.values()),
            });
          }
        });

        socket.emit('server:joined', { serverId });
      } catch (err) {
        console.error('server:join error', err);
      }
    });

    socket.on('server:leave', ({ serverId }) => {
      socket.leave(`server:${serverId}`);
    });

    // ── Typing indicators ─────────────────────────────────────────────
    socket.on('typing:start', ({ channelId }) => {
      if (!typingUsers.has(channelId)) typingUsers.set(channelId, new Map());
      const ct = typingUsers.get(channelId);
      if (ct.has(user._id.toString())) clearTimeout(ct.get(user._id.toString()));

      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId, userId: user._id, username: user.username, isTyping: true,
      });

      const timeout = setTimeout(() => {
        ct.delete(user._id.toString());
        io.to(`channel:${channelId}`).emit('typing:update', {
          channelId, userId: user._id, username: user.username, isTyping: false,
        });
      }, 5000);
      ct.set(user._id.toString(), timeout);
    });

    socket.on('typing:stop', ({ channelId }) => {
      const ct = typingUsers.get(channelId);
      if (ct?.has(user._id.toString())) {
        clearTimeout(ct.get(user._id.toString()));
        ct.delete(user._id.toString());
      }
      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId, userId: user._id, isTyping: false,
      });
    });

    // ── Channel lock/unlock (admin only) ──────────────────────────────
    socket.on('channel:lock', async ({ channelId, locked }) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) return;
        const server = await Server.findById(channel.server);
        const member = server?.members.find(m => m.user.equals(user._id));
        if (!['owner', 'admin', 'moderator'].includes(member?.role)) return;

        channel.locked = locked;
        await channel.save();

        io.to(`channel:${channelId}`).emit('channel:lock-update', { channelId, locked });
        io.to(`server:${channel.server}`).emit('channel:updated', {
          channelId, locked, serverId: channel.server.toString(),
        });
      } catch (err) {
        console.error('channel:lock error', err);
      }
    });

    // ── Voice channel ─────────────────────────────────────────────────
    socket.on('voice:join', async ({ channelId }) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel || channel.type !== 'voice') return;

        if (!voiceChannels.has(channelId)) voiceChannels.set(channelId, new Map());
        const vcUsers = voiceChannels.get(channelId);

        if (channel.userLimit > 0 && vcUsers.size >= channel.userLimit) {
          socket.emit('voice:full', { channelId });
          return;
        }

        const voiceUser = {
          userId: user._id.toString(),
          socketId: socket.id,
          username: user.username,
          displayName: user.displayName || user.username,
          avatarColor: user.avatarColor || '#4f46e5',
          muted: false,
          deafened: false,
          screenSharing: false,
        };
        vcUsers.set(user._id.toString(), voiceUser);
        socket.join(`voice:${channelId}`);

        // Send existing users to the new joiner
        const existingUsers = Array.from(vcUsers.values()).filter(u => u.userId !== user._id.toString());
        socket.emit('voice:users', { channelId, users: existingUsers });

        // Tell everyone else this user joined
        socket.to(`voice:${channelId}`).emit('voice:user-joined', {
          channelId,
          user: voiceUser,
        });

        // Broadcast updated member list to server (for sidebar)
        broadcastVoiceState(io, channelId);

        await Channel.findByIdAndUpdate(channelId, { $addToSet: { activeVoiceUsers: user._id } });
      } catch (err) {
        console.error('voice:join error', err);
      }
    });

    socket.on('voice:leave', ({ channelId }) => {
      leaveVoiceChannel(io, socket, user, channelId);
    });

    // WebRTC signaling relay
    socket.on('voice:offer', ({ channelId, targetUserId, offer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:offer', { channelId, fromUserId: user._id.toString(), offer });
    });

    socket.on('voice:answer', ({ channelId, targetUserId, answer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:answer', { channelId, fromUserId: user._id.toString(), answer });
    });

    socket.on('voice:ice-candidate', ({ channelId, targetUserId, candidate }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:ice-candidate', { channelId, fromUserId: user._id.toString(), candidate });
    });

    socket.on('voice:toggle-mute', ({ channelId, muted }) => {
      const vcUsers = voiceChannels.get(channelId);
      if (vcUsers?.has(user._id.toString())) {
        vcUsers.get(user._id.toString()).muted = muted;
        io.to(`voice:${channelId}`).emit('voice:state-change', { channelId, userId: user._id.toString(), muted });
        broadcastVoiceState(io, channelId);
      }
    });

    // ── Screen sharing ────────────────────────────────────────────────
    socket.on('voice:screen-share-start', ({ channelId }) => {
      const vcUsers = voiceChannels.get(channelId);
      if (vcUsers?.has(user._id.toString())) {
        vcUsers.get(user._id.toString()).screenSharing = true;
        // Notify others to request a new peer connection for screen share
        socket.to(`voice:${channelId}`).emit('voice:screen-share-started', {
          channelId,
          userId: user._id.toString(),
          username: user.username,
        });
        broadcastVoiceState(io, channelId);
      }
    });

    socket.on('voice:screen-share-stop', ({ channelId }) => {
      const vcUsers = voiceChannels.get(channelId);
      if (vcUsers?.has(user._id.toString())) {
        vcUsers.get(user._id.toString()).screenSharing = false;
        io.to(`voice:${channelId}`).emit('voice:screen-share-stopped', {
          channelId,
          userId: user._id.toString(),
        });
        broadcastVoiceState(io, channelId);
      }
    });

    // Screen share WebRTC relay (separate peer connections)
    socket.on('voice:screen-offer', ({ channelId, targetUserId, offer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:screen-offer', { channelId, fromUserId: user._id.toString(), offer });
    });

    socket.on('voice:screen-answer', ({ channelId, targetUserId, answer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:screen-answer', { channelId, fromUserId: user._id.toString(), answer });
    });

    socket.on('voice:screen-ice-candidate', ({ channelId, targetUserId, candidate }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('voice:screen-ice-candidate', { channelId, fromUserId: user._id.toString(), candidate });
    });

    // ── Watch Party ───────────────────────────────────────────────────
    // watch:start  { channelId, url, type }   → start a watch party
    // watch:play   { channelId, time }         → play/resume
    // watch:pause  { channelId, time }         → pause
    // watch:seek   { channelId, time }         → seek to time
    // watch:stop   { channelId }               → end party
    // watch:state  { channelId }               → request current state (new joiners)

    const watchParties = new Map(); // channelId -> { url, type, playing, time, startedAt, hostId }

    socket.on('watch:start', ({ channelId, url, type }) => {
      watchParties.set(channelId, { url, type, playing: false, time: 0, hostId: user._id.toString() });
      io.to(`channel:${channelId}`).emit('watch:started', { channelId, url, type, hostId: user._id.toString(), displayName: user.displayName || user.username });
    });

    socket.on('watch:play', ({ channelId, time }) => {
      const party = watchParties.get(channelId);
      if (party) { party.playing = true; party.time = time; party.startedAt = Date.now(); }
      socket.to(`channel:${channelId}`).emit('watch:play', { channelId, time, from: user._id.toString() });
    });

    socket.on('watch:pause', ({ channelId, time }) => {
      const party = watchParties.get(channelId);
      if (party) { party.playing = false; party.time = time; }
      socket.to(`channel:${channelId}`).emit('watch:pause', { channelId, time, from: user._id.toString() });
    });

    socket.on('watch:seek', ({ channelId, time }) => {
      const party = watchParties.get(channelId);
      if (party) { party.time = time; }
      socket.to(`channel:${channelId}`).emit('watch:seek', { channelId, time, from: user._id.toString() });
    });

    socket.on('watch:stop', ({ channelId }) => {
      watchParties.delete(channelId);
      io.to(`channel:${channelId}`).emit('watch:stopped', { channelId });
    });

    socket.on('watch:sync-request', ({ channelId }) => {
      const party = watchParties.get(channelId);
      if (party) {
        const currentTime = party.playing
          ? party.time + (Date.now() - party.startedAt) / 1000
          : party.time;
        socket.emit('watch:sync', { channelId, ...party, time: currentTime });
      }
    });

    // ── Status ────────────────────────────────────────────────────────
    socket.on('status:update', async ({ status }) => {
      if (!['online', 'idle', 'dnd', 'offline'].includes(status)) return;
      await user.updateOne({ status });
      broadcastUserStatus(io, user._id.toString(), status);
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ Disconnected: ${user.username}`);
      onlineUsers.delete(user._id.toString());

      voiceChannels.forEach((vcUsers, channelId) => {
        if (vcUsers.has(user._id.toString())) leaveVoiceChannel(io, socket, user, channelId);
      });

      typingUsers.forEach((ct, channelId) => {
        if (ct.has(user._id.toString())) {
          clearTimeout(ct.get(user._id.toString()));
          ct.delete(user._id.toString());
          io.to(`channel:${channelId}`).emit('typing:update', { channelId, userId: user._id, isTyping: false });
        }
      });

      await user.updateOne({ status: 'offline', lastSeen: new Date() });
      broadcastUserStatus(io, user._id.toString(), 'offline');
    });
  });
};

function leaveVoiceChannel(io, socket, user, channelId) {
  const vcUsers = voiceChannels.get(channelId);
  if (!vcUsers) return;

  vcUsers.delete(user._id.toString());
  if (vcUsers.size === 0) voiceChannels.delete(channelId);

  socket.leave(`voice:${channelId}`);
  io.to(`voice:${channelId}`).emit('voice:user-left', { channelId, userId: user._id.toString() });

  // Update sidebar member list
  broadcastVoiceState(io, channelId);

  Channel.findByIdAndUpdate(channelId, { $pull: { activeVoiceUsers: user._id } }).catch(console.error);
}

function broadcastUserStatus(io, userId, status) {
  io.emit('user:status', { userId, status });
}


