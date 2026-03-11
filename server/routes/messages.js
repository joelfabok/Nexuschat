import express from 'express';
import Message from '../models/Message.js';
import Channel from '../models/Channel.js';
import Server from '../models/Server.js';
import { authenticate } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

const getUserRole = async (userId, serverId) => {
  const server = await Server.findById(serverId);
  return server?.members.find(m => m.user.equals(userId))?.role || null;
};

// GET messages
router.get('/channel/:channelId', authenticate, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const role = await getUserRole(req.user._id, channel.server);
    if (!role) return res.status(403).json({ error: 'Not a member' });

    const { before, limit = 50 } = req.query;
    const query = { channel: req.params.channelId, deleted: false };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 100))
      .populate('author', 'username displayName avatar avatarColor')
      .populate('replyTo')
      .lean();

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST message
router.post('/channel/:channelId', authenticate, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const role = await getUserRole(req.user._id, channel.server);
    if (!role) return res.status(403).json({ error: 'Not a member' });

    // Locked channel — only admins/owners can post
    if (channel.locked && !['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'This channel is locked', locked: true });
    }

    // Announcement channel — only staff can post
    if (channel.type === 'announcement' && !['owner', 'admin', 'moderator'].includes(role)) {
      return res.status(403).json({ error: 'Only staff can post in announcement channels' });
    }

    // Slow mode
    if (channel.slowMode > 0 && !['owner', 'admin', 'moderator'].includes(role)) {
      const recent = await Message.findOne({
        channel: req.params.channelId,
        author: req.user._id,
        createdAt: { $gt: new Date(Date.now() - channel.slowMode * 1000) },
      });
      if (recent) {
        const wait = Math.ceil((channel.slowMode * 1000 - (Date.now() - recent.createdAt)) / 1000);
        return res.status(429).json({ error: `Slow mode: wait ${wait}s`, wait });
      }
    }

    const { content, replyTo } = req.body;
    if (!content?.trim() && !req.body.attachments?.length) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const message = await Message.create({
      content: content?.trim() || '',
      author: req.user._id,
      channel: req.params.channelId,
      server: channel.server,
      replyTo: replyTo || null,
      attachments: req.body.attachments || [],
    });

    await Channel.findByIdAndUpdate(req.params.channelId, { lastMessage: message._id });

    const populated = await Message.findById(message._id)
      .populate('author', 'username displayName avatar avatarColor')
      .populate('replyTo');

    io.to(`channel:${req.params.channelId}`).emit('message:new', populated);
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PATCH (edit) message
router.patch('/:messageId', authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (!message.author.equals(req.user._id)) return res.status(403).json({ error: 'Not your message' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id).populate('author', 'username displayName avatar avatarColor');
    io.to(`channel:${message.channel}`).emit('message:edited', populated);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE message
router.delete('/:messageId', authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const server = await Server.findById(message.server);
    const member = server?.members.find(m => m.user.equals(req.user._id));
    const canDelete = message.author.equals(req.user._id) || ['owner', 'admin', 'moderator'].includes(member?.role);
    if (!canDelete) return res.status(403).json({ error: 'Permission denied' });

    message.deleted = true;
    message.content = '[Message deleted]';
    await message.save();

    io.to(`channel:${message.channel}`).emit('message:deleted', { messageId: message._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Reactions
router.post('/:messageId/react', authenticate, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Not found' });

    const reaction = message.reactions.find(r => r.emoji === emoji);
    if (reaction) {
      const idx = reaction.users.indexOf(req.user._id);
      if (idx > -1) { reaction.users.splice(idx, 1); reaction.count--; if (reaction.count === 0) message.reactions = message.reactions.filter(r => r.emoji !== emoji); }
      else { reaction.users.push(req.user._id); reaction.count++; }
    } else {
      message.reactions.push({ emoji, users: [req.user._id], count: 1 });
    }

    await message.save();
    io.to(`channel:${message.channel}`).emit('message:reaction', { messageId: message._id, reactions: message.reactions });
    res.json(message.reactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to react' });
  }
});

export default router;
