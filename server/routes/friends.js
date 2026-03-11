import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Notification from '../models/Notification.js';
import { io } from '../index.js';

const router = express.Router();

// ── Helper: push a real-time notification to a user ──────────────────────────
async function createNotification(recipientId, type, actorId, message, suggestion = null, friendRequestId = null) {
  const notif = await Notification.create({
    recipient: recipientId,
    type,
    actor: actorId,
    message,
    suggestion,
    friendRequestId,
  });
  const populated = await notif.populate('actor', 'username displayName avatarColor avatar');
  io.to(`user:${recipientId}`).emit('notification:new', populated);
  return notif;
}

// ── GET /friends — list accepted friends ─────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends.user', 'username displayName avatar status avatarColor customStatus');
    const accepted = user.friends
      .filter(f => f.status === 'accepted')
      .map(f => f.user);
    res.json(accepted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// ── GET /friends/requests — incoming pending requests ────────────────────────
router.get('/requests', authenticate, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ recipient: req.user._id, status: 'pending' })
      .populate('sender', 'username displayName avatar avatarColor status')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ── GET /friends/sent — outgoing pending requests ────────────────────────────
router.get('/sent', authenticate, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ sender: req.user._id, status: 'pending' })
      .populate('recipient', 'username displayName avatar avatarColor status')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// ── POST /friends/request/:userId — send a friend request ────────────────────
router.post('/request/:userId', authenticate, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Already friends?
    const sender = await User.findById(req.user._id);
    const alreadyFriends = sender.friends.some(
      f => f.user.toString() === targetId && f.status === 'accepted'
    );
    if (alreadyFriends) return res.status(400).json({ error: 'Already friends' });

    // Existing pending request?
    const existing = await FriendRequest.findOne({
      sender: req.user._id, recipient: targetId, status: 'pending',
    });
    if (existing) return res.status(400).json({ error: 'Friend request already sent' });

    // Did target already send us a request? Auto-accept.
    const reverse = await FriendRequest.findOne({
      sender: targetId, recipient: req.user._id, status: 'pending',
    });
    if (reverse) {
      // Accept the reverse request instead
      return acceptRequest(reverse._id, req.user._id, res);
    }

    const request = await FriendRequest.create({
      sender: req.user._id,
      recipient: targetId,
    });

    await createNotification(
      targetId,
      'friend_request',
      req.user._id,
      `${sender.displayName || sender.username} sent you a friend request.`,
      'Accept or decline in your notifications.',
      request._id,
    );

    res.json({ message: 'Friend request sent', requestId: request._id });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Friend request already sent' });
    console.error(err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// ── POST /friends/accept/:requestId ──────────────────────────────────────────
router.post('/accept/:requestId', authenticate, async (req, res) => {
  return acceptRequest(req.params.requestId, req.user._id, res);
});

async function acceptRequest(requestId, acceptingUserId, res) {
  try {
    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.recipient.toString() !== acceptingUserId.toString()) {
      return res.status(403).json({ error: 'Not your request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already handled' });
    }

    request.status = 'accepted';
    await request.save();

    // Add each user to the other's friends list
    await User.findByIdAndUpdate(acceptingUserId, {
      $pull: { friends: { user: request.sender } },
    });
    await User.findByIdAndUpdate(acceptingUserId, {
      $push: { friends: { user: request.sender, status: 'accepted' } },
    });
    await User.findByIdAndUpdate(request.sender, {
      $pull: { friends: { user: acceptingUserId } },
    });
    await User.findByIdAndUpdate(request.sender, {
      $push: { friends: { user: acceptingUserId, status: 'accepted' } },
    });

    const acceptor = await User.findById(acceptingUserId).select('username displayName');

    // Notify the original sender
    await createNotification(
      request.sender,
      'friend_request_accepted',
      acceptingUserId,
      `${acceptor.displayName || acceptor.username} accepted your friend request.`,
      null,
      request._id,
    );

    // Emit real-time friend list update to both users
    io.to(`user:${request.sender}`).emit('friends:updated');
    io.to(`user:${acceptingUserId}`).emit('friends:updated');

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept request' });
  }
}

// ── POST /friends/decline/:requestId ─────────────────────────────────────────
router.post('/decline/:requestId', authenticate, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already handled' });
    }

    request.status = 'declined';
    await request.save();

    const decliner = await User.findById(req.user._id).select('username displayName');
    await createNotification(
      request.sender,
      'friend_request_declined',
      req.user._id,
      `${decliner.displayName || decliner.username} declined your friend request.`,
      'You can try sending another request later.',
      request._id,
    );

    res.json({ message: 'Friend request declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// ── DELETE /friends/:userId — unfriend ───────────────────────────────────────
router.delete('/:userId', authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: { user: req.params.userId } } });
    await User.findByIdAndUpdate(req.params.userId, { $pull: { friends: { user: req.user._id } } });
    // Clean up any accepted request records
    await FriendRequest.deleteMany({
      $or: [
        { sender: req.user._id, recipient: req.params.userId },
        { sender: req.params.userId, recipient: req.user._id },
      ],
    });
    io.to(`user:${req.params.userId}`).emit('friends:updated');
    io.to(`user:${req.user._id}`).emit('friends:updated');
    res.json({ message: 'Unfriended' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unfriend' });
  }
});

export default router;
