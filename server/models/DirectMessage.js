import mongoose from 'mongoose';

// A DM conversation between 2 users
const dmConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DMMessage',
    default: null,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  // Track read status per participant
  readStatus: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastRead: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
});

dmConversationSchema.index({ participants: 1 });

const dmMessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DMConversation',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    maxlength: 4000,
    default: '',
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DMMessage',
    default: null,
  },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

dmMessageSchema.index({ conversation: 1, createdAt: -1 });

export const DMConversation = mongoose.model('DMConversation', dmConversationSchema);
export const DMMessage = mongoose.model('DMMessage', dmMessageSchema);
