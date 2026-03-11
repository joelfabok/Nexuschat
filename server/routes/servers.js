import express from 'express';
import { nanoid } from 'nanoid';
import Server from '../models/Server.js';
import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const getMember = (server, userId) =>
  server.members.find(m => (m.user._id || m.user).toString() === userId.toString());
const hasRole = (server, userId, roles) => roles.includes(getMember(server, userId)?.role);

// ── GET all servers for current user ──────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const servers = await Server.find({ 'members.user': req.user._id })
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor')
      .lean();
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// ── PREVIEW server by invite code (no auth needed, safe public info only) ─────
// MUST be before /:serverId to avoid route collision
router.get('/preview/:inviteCode', async (req, res) => {
  try {
    const server = await Server.findOne({ inviteCode: req.params.inviteCode })
      .select('name description icon members inviteExpiry')
      .lean();
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });
    if (server.inviteExpiry && server.inviteExpiry < new Date()) {
      return res.status(410).json({ error: 'This invite link has expired' });
    }
    res.json({
      name: server.name,
      description: server.description || '',
      memberCount: server.members.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load invite' });
  }
});

// ── JOIN via invite code ───────────────────────────────────────────────────────
// MUST be before /:serverId
router.post('/join/:inviteCode', authenticate, async (req, res) => {
  try {
    const server = await Server.findOne({ inviteCode: req.params.inviteCode });
    if (!server) return res.status(404).json({ error: 'Invalid invite code' });
    if (server.inviteExpiry && server.inviteExpiry < new Date()) {
      return res.status(410).json({ error: 'Invite link has expired' });
    }
    if (server.members.some(m => m.user.equals(req.user._id))) {
      return res.status(409).json({ error: 'Already a member' });
    }

    server.members.push({ user: req.user._id, role: 'member' });
    await server.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { servers: server._id } });

    const populated = await Server.findById(server._id)
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor');
    res.json(populated);
  } catch (err) {
    console.error('join error', err);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// ── CREATE server ──────────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { name, description, isPublic } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Server name required' });
  try {
    const server = await Server.create({
      name: name.trim(),
      description: description?.trim() || '',
      owner: req.user._id,
      isPublic: isPublic || false,
      inviteCode: nanoid(10),
      members: [{ user: req.user._id, role: 'owner' }],
    });
    const generalText = await Channel.create({ name: 'general', type: 'text', server: server._id, position: 0 });
    const generalVoice = await Channel.create({ name: 'General', type: 'voice', server: server._id, position: 1 });
    server.channels = [generalText._id, generalVoice._id];
    await server.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { servers: server._id } });

    const populated = await Server.findById(server._id)
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor');
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// ── GET server by ID ───────────────────────────────────────────────────────────
router.get('/:serverId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId)
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor');
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (!server.members.some(m => (m.user._id || m.user).equals(req.user._id))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// ── UPDATE server ──────────────────────────────────────────────────────────────
router.patch('/:serverId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (!hasRole(server, req.user._id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { name, description, icon } = req.body;
    if (name !== undefined) server.name = name.trim().slice(0, 100);
    if (description !== undefined) server.description = description.trim().slice(0, 500);
    if (icon !== undefined) server.icon = icon;
    await server.save();

    const populated = await Server.findById(server._id)
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// ── DELETE server ──────────────────────────────────────────────────────────────
router.delete('/:serverId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (!server.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can delete this server' });
    }
    await Message.deleteMany({ server: server._id });
    await Channel.deleteMany({ server: server._id });
    await User.updateMany({ servers: server._id }, { $pull: { servers: server._id } });
    await Server.findByIdAndDelete(server._id);
    res.json({ message: 'Server deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// ── GENERATE invite code ───────────────────────────────────────────────────────
router.post('/:serverId/invite', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (!hasRole(server, req.user._id, ['owner', 'admin'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    server.inviteCode = nanoid(10);
    server.inviteExpiry = req.body.expiry ? new Date(req.body.expiry) : null;
    await server.save();
    res.json({ inviteCode: server.inviteCode, inviteExpiry: server.inviteExpiry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invite' });
  }
});

// ── KICK member ────────────────────────────────────────────────────────────────
router.post('/:serverId/kick/:memberId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (!hasRole(server, req.user._id, ['owner', 'admin', 'moderator'])) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const target = getMember(server, req.params.memberId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot kick the owner' });

    server.members = server.members.filter(m => m.user.toString() !== req.params.memberId);
    await server.save();
    await User.findByIdAndUpdate(req.params.memberId, { $pull: { servers: server._id } });
    res.json({ message: 'Member kicked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// ── UPDATE member role ─────────────────────────────────────────────────────────
router.patch('/:serverId/members/:memberId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (!server.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }
    const member = server.members.find(m => m.user.toString() === req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });

    const { role } = req.body;
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    member.role = role;
    await server.save();

    const populated = await Server.findById(server._id)
      .populate('channels', 'name type position topic locked isPrivate slowMode userLimit')
      .populate('members.user', 'username displayName avatar status avatarColor');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ── LEAVE server ───────────────────────────────────────────────────────────────
router.post('/:serverId/leave', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (server.owner.equals(req.user._id)) {
      return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete server.' });
    }
    server.members = server.members.filter(m => !m.user.equals(req.user._id));
    await server.save();
    await User.findByIdAndUpdate(req.user._id, { $pull: { servers: server._id } });
    res.json({ message: 'Left server' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

export default router;
