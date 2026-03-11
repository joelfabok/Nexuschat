import express from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Search users ──────────────────────────────────────────────────────────────
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short' });
  try {
    let users;
    // Support username#tag exact lookup
    if (q.includes('#')) {
      const [uname, tag] = q.split('#');
      users = await User.find({
        username: { $regex: uname.trim(), $options: 'i' },
        userTag: tag.trim(),
        _id: { $ne: req.user._id },
      }).select('username userTag displayName avatar status avatarColor').limit(5).lean();
    } else {
      users = await User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { displayName: { $regex: q, $options: 'i' } },
        ],
        _id: { $ne: req.user._id },
      }).select('username userTag displayName avatar status avatarColor').limit(20).lean();
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Get own full profile ──────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -refreshTokens -banned -serverMutes');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── Update own profile ────────────────────────────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  const {
    displayName, customStatus, avatar, avatarColor, status,
    bio, bannerColor, location, website, socialLinks, statusPost,
  } = req.body;
  try {
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName.trim().slice(0, 32);
    if (customStatus !== undefined) updates.customStatus = customStatus.trim().slice(0, 128);
    if (avatar !== undefined) updates.avatar = avatar;
    if (avatarColor !== undefined) updates.avatarColor = avatarColor;
    if (status !== undefined && ['online', 'idle', 'dnd', 'offline'].includes(status)) updates.status = status;
    if (bio !== undefined) updates.bio = bio.trim().slice(0, 300);
    if (bannerColor !== undefined) updates.bannerColor = bannerColor;
    if (location !== undefined) updates.location = location.trim().slice(0, 64);
    if (website !== undefined) updates.website = website.trim().slice(0, 128);
    if (socialLinks !== undefined) {
      updates.socialLinks = {
        twitter: (socialLinks.twitter || '').trim().slice(0, 64),
        github: (socialLinks.github || '').trim().slice(0, 64),
        instagram: (socialLinks.instagram || '').trim().slice(0, 64),
      };
    }
    if (statusPost !== undefined) {
      updates.statusPost = statusPost.trim().slice(0, 280);
      updates.statusPostUpdatedAt = new Date();
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-password -refreshTokens -banned -serverMutes');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── Get public profile by userId ──────────────────────────────────────────────
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username userTag displayName avatar status customStatus avatarColor bannerColor bio location website socialLinks statusPost statusPostUpdatedAt subscriptionTier createdAt friends dmPrivacy');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Determine friendship status between viewer and this user
    const viewer = await User.findById(req.user._id).select('friends');
    const isFriend = viewer.friends.some(
      f => f.user.toString() === req.params.userId && f.status === 'accepted'
    );
    const pendingRequest = await FriendRequest.findOne({
      sender: req.user._id, recipient: req.params.userId, status: 'pending',
    });
    const receivedRequest = await FriendRequest.findOne({
      sender: req.params.userId, recipient: req.user._id, status: 'pending',
    });

    res.json({
      ...user.toObject(),
      friendStatus: isFriend ? 'friends'
        : pendingRequest ? 'request_sent'
        : receivedRequest ? 'request_received'
        : 'none',
      pendingRequestId: receivedRequest?._id || null,
      friendCount: user.friends.filter(f => f.status === 'accepted').length,
      friends: undefined, // don't leak friend list
      dmPrivacy: undefined, // don't leak privacy setting
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
