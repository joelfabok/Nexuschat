import mongoose from 'mongoose';

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  description: {
    type: String,
    maxlength: 500,
    default: '',
  },
  icon: {
    type: String,
    default: null,
  },
  banner: {
    type: String,
    default: null,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['owner', 'admin', 'moderator', 'member'], default: 'member' },
    nickname: { type: String, maxlength: 32, default: null },
    joinedAt: { type: Date, default: Date.now },
  }],
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
  }],
  roles: [{
    name: { type: String, required: true },
    color: { type: String, default: '#99aab5' },
    permissions: {
      sendMessages: { type: Boolean, default: true },
      manageMessages: { type: Boolean, default: false },
      manageChannels: { type: Boolean, default: false },
      manageServer: { type: Boolean, default: false },
      kickMembers: { type: Boolean, default: false },
      banMembers: { type: Boolean, default: false },
    },
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  inviteExpiry: {
    type: Date,
    default: null,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

serverSchema.index({ inviteCode: 1 });
serverSchema.index({ owner: 1 });

export default mongoose.model('Server', serverSchema);
