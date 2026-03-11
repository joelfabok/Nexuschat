import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Message from '../models/Message.js';
import { io } from '../index.js';

const router = express.Router();

// Toggle reaction on a message
router.post('/:messageId/react', authenticate, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji required' });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const userId = req.user._id.toString();
    const existing = message.reactions.find(r => r.emoji === emoji);

    if (existing) {
      const idx = existing.users.findIndex(u => u.toString() === userId);
      if (idx >= 0) {
        existing.users.splice(idx, 1);
        existing.count = existing.users.length;
        if (existing.count === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        existing.users.push(req.user._id);
        existing.count = existing.users.length;
      }
    } else {
      message.reactions.push({ emoji, users: [req.user._id], count: 1 });
    }

    await message.save();

    // Broadcast to channel
    io.to(`channel:${message.channel}`).emit('message:reaction', {
      messageId: message._id,
      reactions: message.reactions.map(r => ({ emoji: r.emoji, count: r.count, users: r.users })),
    });

    res.json({ reactions: message.reactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

export default router;
