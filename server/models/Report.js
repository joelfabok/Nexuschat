import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'hate_speech', 'nsfw', 'misinformation', 'other'],
    required: true,
  },
  details: { type: String, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, enum: ['none', 'warn', 'mute', 'kick', 'ban', 'message_deleted'], default: 'none' },
}, { timestamps: true });

reportSchema.index({ server: 1, status: 1 });

export default mongoose.model('Report', reportSchema);
