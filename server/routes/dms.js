import express from 'express';
import { DMConversation, DMMessage } from '../models/DirectMessage.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { io } from '../index.js';

const router = express.Router();

// ── Privacy check helper ──────────────────────────────────────────────────────
async function checkDMPrivacy(sender, targetUser) {
  const privacy = targetUser.dmPrivacy || 'everyone';
  if (privacy === 'everyone') return { allowed: true };
  if (privacy === 'nobody') return { allowed: false, reason: 'This user is not accepting DMs at this time.', suggestion: null };
  // friends only
  const isFriend = sender.friends.some(f => f.user.toString() === targetUser._id.toString() && f.status === 'accepted');
  if (isFriend) return { allowed: true };
  return { allowed: false, reason: 'You can only DM this user if you are friends.', suggestion: 'You can send a friend request to this user to be able to DM them.' };
}

// ── GET all conversations ─────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await DMConversation.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar status avatarColor dmPrivacy')
      .populate({ path: 'lastMessage', populate: { path: 'author', select: 'username displayName' } })
      .sort({ lastActivity: -1 }).lean();
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ── POST /start/:userId — start or get DM (privacy enforced) ─────────────────
router.post('/start/:userId', authenticate, async (req, res) => {
  if (req.params.userId === req.user._id.toString()) return res.status(400).json({ error: 'Cannot DM yourself' });
  try {
    const [sender, targetUser] = await Promise.all([User.findById(req.user._id), User.findById(req.params.userId)]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const privacy = await checkDMPrivacy(sender, targetUser);
    if (!privacy.allowed) {
      await Notification.create({ recipient: sender._id, type: 'dm_blocked', actor: targetUser._id, message: privacy.reason, suggestion: privacy.suggestion });
      return res.status(403).json({ error: privacy.reason, suggestion: privacy.suggestion, privacyBlocked: true });
    }

    let conversation = await DMConversation.findOne({ participants: { $all: [req.user._id, req.params.userId], $size: 2 } })
      .populate('participants', 'username displayName avatar status avatarColor dmPrivacy');

    if (!conversation) {
      const created = await DMConversation.create({ participants: [req.user._id, req.params.userId], readStatus: [{ user: req.user._id, lastRead: new Date() }, { user: req.params.userId, lastRead: new Date() }] });
      conversation = await DMConversation.findById(created._id).populate('participants', 'username displayName avatar status avatarColor dmPrivacy');
    }

    res.json({ allowed: true, conversation });
  } catch (err) {
    console.error('start DM error', err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// ── PATCH /privacy — update own DM privacy ───────────────────────────────────
router.patch('/privacy', authenticate, async (req, res) => {
  try {
    const { dmPrivacy } = req.body;
    if (!['everyone', 'friends', 'nobody'].includes(dmPrivacy)) return res.status(400).json({ error: 'Invalid. Use: everyone, friends, nobody' });
    const user = await User.findByIdAndUpdate(req.user._id, { dmPrivacy }, { new: true }).select('dmPrivacy');
    res.json({ dmPrivacy: user.dmPrivacy });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update privacy' });
  }
});

// ── GET messages ───────────────────────────────────────────────────────────────
router.get('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const conversation = await DMConversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    if (!conversation.participants.some(p => p.equals(req.user._id))) return res.status(403).json({ error: 'Not a participant' });
    await DMConversation.updateOne({ _id: conversation._id, 'readStatus.user': req.user._id }, { $set: { 'readStatus.$.lastRead': new Date() } });
    const { before, limit = 50 } = req.query;
    const query = { conversation: req.params.conversationId, deleted: false };
    if (before) query.createdAt = { $lt: new Date(before) };
    const messages = await DMMessage.find(query).sort({ createdAt: -1 }).limit(Math.min(Number(limit), 100)).populate('author', 'username displayName avatar avatarColor').lean();
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ── SEND DM (privacy enforced on every send) ──────────────────────────────────
router.post('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const conversation = await DMConversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    if (!conversation.participants.some(p => p.equals(req.user._id))) return res.status(403).json({ error: 'Not a participant' });

    const sender = await User.findById(req.user._id);
    const recipientId = conversation.participants.find(p => !p.equals(req.user._id));
    const recipient = await User.findById(recipientId);
    if (recipient) {
      const privacy = await checkDMPrivacy(sender, recipient);
      if (!privacy.allowed) {
        await Notification.create({ recipient: sender._id, type: 'dm_blocked', actor: recipient._id, message: privacy.reason, suggestion: privacy.suggestion });
        return res.status(403).json({ error: privacy.reason, suggestion: privacy.suggestion, privacyBlocked: true });
      }
    }

    const { content, attachments } = req.body;
    if (!content?.trim() && !attachments?.length) return res.status(400).json({ error: 'Message cannot be empty' });

    const message = await DMMessage.create({ conversation: req.params.conversationId, author: req.user._id, content: content?.trim() || '', attachments: attachments || [] });
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    const populated = await DMMessage.findById(message._id).populate('author', 'username displayName avatar avatarColor');
    conversation.participants.forEach(pid => {
      io.to(`user:${pid}`).emit('dm:message', { conversationId: req.params.conversationId, message: populated });
    });

    res.status(201).json(populated);
  } catch (err) {
    console.error('send DM error', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── EDIT DM ────────────────────────────────────────────────────────────────────
router.patch('/:conversationId/messages/:messageId', authenticate, async (req, res) => {
  try {
    const message = await DMMessage.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Not found' });
    if (!message.author.equals(req.user._id)) return res.status(403).json({ error: 'Not your message' });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    message.content = content.trim(); message.edited = true; message.editedAt = new Date();
    await message.save();
    const populated = await DMMessage.findById(message._id).populate('author', 'username displayName avatar avatarColor');
    const conv = await DMConversation.findById(req.params.conversationId);
    conv?.participants.forEach(pid => io.to(`user:${pid}`).emit('dm:message-edited', { conversationId: req.params.conversationId, message: populated }));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// ── DELETE DM ──────────────────────────────────────────────────────────────────
router.delete('/:conversationId/messages/:messageId', authenticate, async (req, res) => {
  try {
    const message = await DMMessage.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Not found' });
    if (!message.author.equals(req.user._id)) return res.status(403).json({ error: 'Not your message' });
    message.deleted = true; message.content = '[Message deleted]';
    await message.save();
    const conv = await DMConversation.findById(req.params.conversationId);
    conv?.participants.forEach(pid => io.to(`user:${pid}`).emit('dm:message-deleted', { conversationId: req.params.conversationId, messageId: message._id }));
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ── DELETE DM CONVERSATION ─────────────────────────────────────────────────
router.delete('/:conversationId', authenticate, async (req, res) => {
  try {
    const conversation = await DMConversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation.participants.some(p => p.equals(req.user._id))) return res.status(403).json({ error: 'Not a participant' });

    await DMConversation.findByIdAndDelete(conversation._id);
    await DMMessage.deleteMany({ conversation: conversation._id });

    conversation.participants.forEach(pid => {
      io.to(`user:${pid}`).emit('dm:conversation-deleted', { conversationId: conversation._id });
    });

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('delete DM conversation error', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
