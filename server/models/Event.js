import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 2000, default: '' },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['voice', 'watch', 'stream'], default: 'voice' },
  scheduledAt: { type: Date, required: true },
  endsAt: { type: Date, default: null },
  coverImage: { type: String, default: null },
  streamUrl: { type: String, default: null }, // YouTube/Twitch/Kick URL for watch events
  // For paid events
  price: { type: Number, default: 0 }, // cents
  maxAttendees: { type: Number, default: 0 }, // 0 = unlimited
  // RSVPs
  attendees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['going', 'maybe', 'not_going'], default: 'going' },
    ticketPurchased: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
  }],
  status: { type: String, enum: ['scheduled', 'live', 'ended', 'cancelled'], default: 'scheduled' },
  remindersSent: { type: Boolean, default: false },
  // Session highlight clips
  highlights: [{
    title: { type: String },
    timestamp: { type: Date },
    fileUrl: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  // Paid event
  stripeProductId: { type: String, default: null },
  stripePriceId: { type: String, default: null },
}, { timestamps: true });

eventSchema.index({ server: 1, scheduledAt: 1 });
eventSchema.index({ scheduledAt: 1, status: 1 });

export default mongoose.model('Event', eventSchema);
