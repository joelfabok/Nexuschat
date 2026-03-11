import express from 'express';
import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import Message from '../models/Message.js';
import { authenticate } from '../middleware/auth.js';
import { getUserRole, resolveUserPermissions } from '../middleware/permissions.js';

const router = express.Router();

const canManageServer = async (userId, serverId) => {
  const role = await getUserRole(userId, serverId);
  return ['owner', 'admin'].includes(role);
};

// Create channel
router.post('/', authenticate, async (req, res) => {
  const { serverId, name, type = 'text', topic, isPrivate = false } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (!await canManageServer(req.user._id, serverId)) return res.status(403).json({ error: 'Insufficient permissions' });

  try {
    const channelCount = await Channel.countDocuments({ server: serverId });

    // For private channels, default to denying everyone view access
    const permissionOverrides = isPrivate
      ? [{ role: 'everyone', viewChannel: false, sendMessages: false, readHistory: false, addReactions: false, attachFiles: false }]
      : [];

    const channel = await Channel.create({
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      server: serverId,
      topic: topic?.trim() || '',
      position: channelCount,
      isPrivate,
      permissionOverrides,
    });

    await Server.findByIdAndUpdate(serverId, { $push: { channels: channel._id } });
    res.status(201).json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Get channel permissions for current user
router.get('/:channelId/permissions', authenticate, async (req, res) => {
  try {
    const perms = await resolveUserPermissions(req.user._id, req.params.channelId);
    if (!perms) return res.status(403).json({ error: 'Not a member' });
    res.json(perms);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get full channel permission overrides (for settings UI)
router.get('/:channelId/permission-overrides', authenticate, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Not found' });
    if (!await canManageServer(req.user._id, channel.server)) return res.status(403).json({ error: 'Insufficient permissions' });
    res.json(channel.permissionOverrides);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Update channel settings + permissions
router.patch('/:channelId', authenticate, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Not found' });
    if (!await canManageServer(req.user._id, channel.server)) return res.status(403).json({ error: 'Insufficient permissions' });

    const { name, topic, slowMode, userLimit, type, isPrivate, permissionOverrides, nsfw } = req.body;
    if (name !== undefined) channel.name = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (topic !== undefined) channel.topic = topic.trim().slice(0, 1024);
    if (slowMode !== undefined) channel.slowMode = Math.min(Math.max(0, slowMode), 21600);
    if (userLimit !== undefined) channel.userLimit = userLimit;
    if (type !== undefined && ['text', 'voice', 'announcement'].includes(type)) channel.type = type;
    if (isPrivate !== undefined) channel.isPrivate = isPrivate;
    if (nsfw !== undefined) channel.nsfw = nsfw;

    // Update permission overrides
    if (permissionOverrides !== undefined) {
      channel.permissionOverrides = permissionOverrides;

      // Sync isPrivate based on everyone's viewChannel permission
      const everyoneOverride = permissionOverrides.find(o => o.role === 'everyone');
      if (everyoneOverride && everyoneOverride.viewChannel === false) {
        channel.isPrivate = true;
      } else if (everyoneOverride && everyoneOverride.viewChannel === true) {
        channel.isPrivate = false;
      }
    }

    await channel.save();
    res.json(channel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete channel
router.delete('/:channelId', authenticate, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Not found' });
    if (!await canManageServer(req.user._id, channel.server)) return res.status(403).json({ error: 'Insufficient permissions' });

    await Message.deleteMany({ channel: channel._id });
    await Channel.findByIdAndDelete(req.params.channelId);
    await Server.findByIdAndUpdate(channel.server, { $pull: { channels: channel._id } });
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

export default router;
