import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Poll from '../models/Poll.js';
import Message from '../models/Message.js';
import Server from '../models/Server.js';
import { io } from '../index.js';

const getMemberRole = (server, userId) => {
  const member = server.members.find(m => (m.user._id || m.user).toString() === userId.toString());
  return member?.role || null;
};

const router = express.Router();

// Create poll
router.post('/', authenticate, async (req, res) => {
  try {
    const { question, options, channelId, serverId, multiChoice, endsAt } = req.body;
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const role = getMemberRole(server, req.user._id);
    if (!['owner', 'admin', 'moderator'].includes(role)) {
      return res.status(403).json({ error: 'Only server staff can create polls' });
    }

    const poll = await Poll.create({
      question, multiChoice,
      options: options.map(text => ({ text, votes: [] })),
      channel: channelId,
      server: serverId,
      author: req.user._id,
      endsAt: endsAt ? new Date(endsAt) : null,
    });

    // Create a message that references the poll
    const msg = await Message.create({
      content: '',
      author: req.user._id,
      channel: channelId,
      server: serverId,
      type: 'default',
      poll: poll._id,
    });

    const populated = await msg.populate([
      { path: 'author', select: 'username displayName avatarColor avatar' },
      { path: 'poll' },
    ]);

    io.to(`channel:${channelId}`).emit('message:new', populated);
    res.json(poll);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Vote on a poll
router.post('/:pollId/vote', authenticate, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await Poll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.closed) return res.status(400).json({ error: 'Poll is closed' });

    const userId = req.user._id;

    if (!poll.multiChoice) {
      // Remove previous vote
      poll.options.forEach(opt => {
        opt.votes = opt.votes.filter(v => v.toString() !== userId.toString());
      });
    }

    const opt = poll.options[optionIndex];
    if (!opt) return res.status(400).json({ error: 'Invalid option' });

    const alreadyVoted = opt.votes.some(v => v.toString() === userId.toString());
    if (alreadyVoted) {
      opt.votes = opt.votes.filter(v => v.toString() !== userId.toString());
    } else {
      opt.votes.push(userId);
    }

    await poll.save();

    io.to(`channel:${poll.channel}`).emit('poll:updated', poll);
    res.json(poll);
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Close a poll
router.post('/:pollId/close', authenticate, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'Not found' });
    const server = await Server.findById(poll.server);
    const role = server ? getMemberRole(server, req.user._id) : null;
    if (!['owner', 'admin', 'moderator'].includes(role)) {
      return res.status(403).json({ error: 'Only staff can close polls' });
    }
    poll.closed = true;
    await poll.save();
    io.to(`channel:${poll.channel}`).emit('poll:updated', poll);
    res.json(poll);
  } catch (err) {
    res.status(500).json({ error: 'Failed to close poll' });
  }
});

export default router;
