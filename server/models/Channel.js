import mongoose from 'mongoose';

// Default permissions per role - what each role CAN do by default
export const DEFAULT_ROLE_PERMISSIONS = {
  everyone: {
    viewChannel: true,
    sendMessages: true,
    addReactions: true,
    attachFiles: true,
    readHistory: true,
    manageMessages: false,
    manageChannel: false,
  },
  moderator: {
    viewChannel: true,
    sendMessages: true,
    addReactions: true,
    attachFiles: true,
    readHistory: true,
    manageMessages: true,
    manageChannel: false,
  },
  admin: {
    viewChannel: true,
    sendMessages: true,
    addReactions: true,
    attachFiles: true,
    readHistory: true,
    manageMessages: true,
    manageChannel: true,
  },
  owner: {
    viewChannel: true,
    sendMessages: true,
    addReactions: true,
    attachFiles: true,
    readHistory: true,
    manageMessages: true,
    manageChannel: true,
  },
};

const permissionOverrideSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['everyone', 'member', 'moderator', 'admin'],
    required: true,
  },
  // null = inherit default, true = allow, false = deny
  viewChannel:    { type: Boolean, default: null },
  sendMessages:   { type: Boolean, default: null },
  addReactions:   { type: Boolean, default: null },
  attachFiles:    { type: Boolean, default: null },
  readHistory:    { type: Boolean, default: null },
  manageMessages: { type: Boolean, default: null },
}, { _id: false });

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    lowercase: true,
  },
  type: {
    type: String,
    enum: ['text', 'voice', 'announcement'],
    default: 'text',
  },
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
  },
  topic: {
    type: String,
    maxlength: 1024,
    default: '',
  },
  position: {
    type: Number,
    default: 0,
  },
  slowMode: {
    type: Number,
    default: 0,
    min: 0,
    max: 21600, // 6 hours max
  },
  nsfw: {
    type: Boolean,
    default: false,
  },
  // Private channel - only visible to roles that have viewChannel: true override
  isPrivate: {
    type: Boolean,
    default: false,
  },
  // Per-role permission overrides for this channel
  permissionOverrides: [permissionOverrideSchema],

  // Voice channel settings
  userLimit: {
    type: Number,
    default: 0,
  },
  bitrate: {
    type: Number,
    default: 64000,
  },
  activeVoiceUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Channel lock - admins can lock so nobody can send messages
  locked: {
    type: Boolean,
    default: false,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  // Active stream embed (voice channels)
  activeStream: {
    url: { type: String, default: null },
    platform: { type: String, enum: ['youtube', 'twitch', 'kick', null], default: null },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: null },
  },
  // Whiteboard session
  whiteboard: {
    active: { type: Boolean, default: false },
    data: { type: String, default: '' }, // JSON canvas state
    lastUpdated: { type: Date, default: null },
  },
  // Analytics
  messageCount: { type: Number, default: 0 },
  voiceMinutes: { type: Number, default: 0 },
}, {
  timestamps: true,
});

channelSchema.index({ server: 1, position: 1 });

// Helper: resolve effective permissions for a given role in this channel
channelSchema.methods.getPermissionsForRole = function(role) {
  // Start with defaults for this role (fall back to 'everyone' defaults)
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.everyone;
  const result = { ...defaults };

  // Apply 'everyone' override first
  const everyoneOverride = this.permissionOverrides.find(o => o.role === 'everyone');
  if (everyoneOverride) {
    Object.keys(result).forEach(perm => {
      if (everyoneOverride[perm] !== null && everyoneOverride[perm] !== undefined) {
        result[perm] = everyoneOverride[perm];
      }
    });
  }

  // Apply role-specific override on top (higher priority)
  if (role !== 'everyone') {
    const roleOverride = this.permissionOverrides.find(o => o.role === role);
    if (roleOverride) {
      Object.keys(result).forEach(perm => {
        if (roleOverride[perm] !== null && roleOverride[perm] !== undefined) {
          result[perm] = roleOverride[perm];
        }
      });
    }
  }

  // Owners and admins always have full access
  if (role === 'owner' || role === 'admin') {
    result.viewChannel = true;
    result.sendMessages = true;
    result.manageMessages = true;
    result.manageChannel = true;
  }

  return result;
};

export default mongoose.model('Channel', channelSchema);
