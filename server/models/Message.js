import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  url: String,
  width: Number,  // for images
  height: Number, // for images
});

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    maxlength: 4000,
    default: '',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
  },
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
  },
  attachments: [attachmentSchema],
  embeds: [{
    type: { type: String },
    url: String,
    title: String,
    description: String,
    image: String,
    color: String,
  }],
  reactions: [{
    emoji: String,
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    count: { type: Number, default: 0 },
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  // Live poll reference (if this message IS a poll)
  poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', default: null },
  // Video annotation (timestamp comment)
  videoAnnotation: {
    timestamp: { type: Number, default: null }, // seconds
    videoUrl: { type: String, default: null },
  },
  // Moderation
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, default: null },
  type: {
    type: String,
    enum: ['default', 'system', 'join', 'leave'],
    default: 'default',
  },
}, {
  timestamps: true,
});

messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ author: 1 });
messageSchema.index({ server: 1 });

export default mongoose.model('Message', messageSchema);
