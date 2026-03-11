import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Server from '../models/Server.js';
import Report from '../models/Report.js';
import { io } from '../index.js';

const router = express.Router();

// Helper: check if user is admin/mod in server
async function requireMod(req, res, serverId) {
  const server = await Server.findById(serverId);
  if (!server) { res.status(404).json({ error: 'Server not found' }); return null; }
  const member = server.members.find(m => m.user.equals(req.user._id));
  if (!member || !['admin', 'owner', 'moderator'].includes(member.role)) {
    res.status(403).json({ error: 'Insufficient permissions' }); return null;
  }
  return { server, role: member.role };
}

// Mute a user in a server (temp mute)
router.post('/mute', authenticate, async (req, res) => {
  try {
    const { userId, serverId, durationMinutes, reason } = req.body;
    const ctx = await requireMod(req, res, serverId);
    if (!ctx) return;

    const until = new Date(Date.now() + (durationMinutes || 10) * 60000);
    await User.findByIdAndUpdate(userId, {
      $pull: { serverMutes: { serverId } },
    });
    await User.findByIdAndUpdate(userId, {
      $push: { serverMutes: { serverId, until, reason } },
    });

    io.to(`server:${serverId}`).emit('moderation:mute', { userId, until, serverId });
    res.json({ message: 'User muted', until });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mute' });
  }
});

// Unmute
router.post('/unmute', authenticate, async (req, res) => {
  try {
    const { userId, serverId } = req.body;
    const ctx = await requireMod(req, res, serverId);
    if (!ctx) return;
    await User.findByIdAndUpdate(userId, { $pull: { serverMutes: { serverId } } });
    io.to(`server:${serverId}`).emit('moderation:unmute', { userId, serverId });
    res.json({ message: 'User unmuted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unmute' });
  }
});

// Kick user from server
router.post('/kick', authenticate, async (req, res) => {
  try {
    const { userId, serverId, reason } = req.body;
    const ctx = await requireMod(req, res, serverId);
    if (!ctx) return;

    await Server.findByIdAndUpdate(serverId, { $pull: { members: { user: userId } } });
    await User.findByIdAndUpdate(userId, { $pull: { servers: serverId } });

    io.to(`user:${userId}`).emit('moderation:kicked', { serverId, reason });
    res.json({ message: 'User kicked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to kick' });
  }
});

// Ban user from server
router.post('/ban', authenticate, async (req, res) => {
  try {
    const { userId, serverId, reason } = req.body;
    const ctx = await requireMod(req, res, serverId);
    if (!ctx) return;

    await Server.findByIdAndUpdate(serverId, { $pull: { members: { user: userId } } });
    await User.findByIdAndUpdate(userId, {
      $pull: { servers: serverId },
      $push: { banned: { serverId, reason, bannedBy: req.user._id } },
    });

    io.to(`user:${userId}`).emit('moderation:banned', { serverId, reason });
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban' });
  }
});

// Unban
router.post('/unban', authenticate, async (req, res) => {
  try {
    const { userId, serverId } = req.body;
    const ctx = await requireMod(req, res, serverId);
    if (!ctx) return;
    await User.findByIdAndUpdate(userId, { $pull: { banned: { serverId } } });
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban' });
  }
});

// Get ban list for server
router.get('/bans/:serverId', authenticate, async (req, res) => {
  try {
    const ctx = await requireMod(req, res, req.params.serverId);
    if (!ctx) return;
    const bannedUsers = await User.find({ 'banned.serverId': req.params.serverId })
      .select('username displayName avatarColor banned');
    res.json(bannedUsers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bans' });
  }
});

// Delete a message (mod action)
router.delete('/message/:messageId', authenticate, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Not found' });

    const ctx = await requireMod(req, res, msg.server);
    if (!ctx) return;

    msg.deleted = true;
    msg.content = '[Message deleted by moderator]';
    await msg.save();

    io.to(`channel:${msg.channel}`).emit('message:deleted', { messageId: msg._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Submit a report
router.post('/report', authenticate, async (req, res) => {
  try {
    const { targetUserId, targetMessageId, serverId, reason, details } = req.body;
    const report = await Report.create({
      reporter: req.user._id,
      targetUser: targetUserId || null,
      targetMessage: targetMessageId || null,
      server: serverId,
      reason, details,
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Get reports for a server (admin only)
router.get('/reports/:serverId', authenticate, async (req, res) => {
  try {
    const ctx = await requireMod(req, res, req.params.serverId);
    if (!ctx) return;
    const reports = await Report.find({ server: req.params.serverId, status: 'pending' })
      .populate('reporter', 'username displayName')
      .populate('targetUser', 'username displayName')
      .populate('targetMessage', 'content')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Resolve a report
router.patch('/reports/:reportId', authenticate, async (req, res) => {
  try {
    const { status, action } = req.body;
    const report = await Report.findById(req.params.reportId).populate('server');
    if (!report) return res.status(404).json({ error: 'Not found' });
    const ctx = await requireMod(req, res, report.server._id);
    if (!ctx) return;
    report.status = status;
    report.action = action || 'none';
    report.reviewedBy = req.user._id;
    await report.save();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

export default router;
