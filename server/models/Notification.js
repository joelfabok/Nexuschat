import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'friend_request',         // someone sent you a friend request
      'friend_request_accepted',// your request was accepted
      'friend_request_declined',// your request was declined
      'dm_blocked',             // your DM was blocked by privacy settings
    ],
    required: true,
  },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who caused it
  message: { type: String, required: true },    // human-readable message
  suggestion: { type: String, default: null },  // optional next-step hint
  read: { type: Boolean, default: false },
  // For friend_request type — we store the request so accept/decline can reference it
  friendRequestId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
