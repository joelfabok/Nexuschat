import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Event from '../models/Event.js';
import Server from '../models/Server.js';
import { io } from '../index.js';

const router = express.Router();

// Get events for a server
router.get('/server/:serverId', authenticate, async (req, res) => {
  try {
    const events = await Event.find({ server: req.params.serverId, status: { $ne: 'cancelled' } })
      .populate('organizer', 'username displayName avatarColor')
      .populate('channel', 'name type')
      .sort({ scheduledAt: 1 })
      .limit(50);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create event
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, serverId, channelId, type, scheduledAt, endsAt, streamUrl, maxAttendees } = req.body;
    if (!title || !scheduledAt) return res.status(400).json({ error: 'title and scheduledAt required' });

    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const member = server.members.find(m => m.user.equals(req.user._id));
    if (!member || !['admin', 'owner', 'moderator'].includes(member.role)) {
      return res.status(403).json({ error: 'Must be admin/mod to create events' });
    }

    const event = await Event.create({
      title, description, server: serverId, channel: channelId || null,
      organizer: req.user._id, type: type || 'voice',
      scheduledAt: new Date(scheduledAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      streamUrl, maxAttendees: maxAttendees || 0,
    });

    const populated = await event.populate('organizer', 'username displayName avatarColor');
    io.to(`server:${serverId}`).emit('event:created', populated);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// RSVP to event
router.post('/:eventId/rsvp', authenticate, async (req, res) => {
  try {
    const { status } = req.body; // going | maybe | not_going
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const existingIdx = event.attendees.findIndex(a => a.user.equals(req.user._id));
    if (existingIdx >= 0) {
      if (status === 'not_going') {
        event.attendees.splice(existingIdx, 1);
      } else {
        event.attendees[existingIdx].status = status;
      }
    } else if (status !== 'not_going') {
      event.attendees.push({ user: req.user._id, status });
    }

    await event.save();
    io.to(`server:${event.server}`).emit('event:updated', { eventId: event._id, attendees: event.attendees });
    res.json({ attendees: event.attendees });
  } catch (err) {
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

// Update event status (admin/organizer)
router.patch('/:eventId/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Not found' });
    if (!event.organizer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    event.status = status;
    await event.save();
    io.to(`server:${event.server}`).emit('event:updated', { eventId: event._id, status });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Add highlight clip to event
router.post('/:eventId/highlight', authenticate, async (req, res) => {
  try {
    const { title, fileUrl } = req.body;
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Not found' });
    event.highlights.push({ title, fileUrl, timestamp: new Date(), createdBy: req.user._id });
    await event.save();
    res.json(event.highlights);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add highlight' });
  }
});

export default router;
