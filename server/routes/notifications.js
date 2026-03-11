import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// ── GET /notifications — fetch all notifications (newest first) ──────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('actor', 'username displayName avatarColor avatar')
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── PATCH /notifications/:id/read — mark one as read ────────────────────────
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ── PATCH /notifications/read-all — mark all as read ────────────────────────
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// ── DELETE /notifications/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
