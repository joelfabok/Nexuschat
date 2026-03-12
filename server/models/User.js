import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 32,
    match: /^[a-zA-Z0-9_.-]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  userTag: {
    type: String,
    default: null, // e.g. "4821" — combined with username = "joel#4821"
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // Never return password by default
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 32,
  },
  avatar: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['online', 'idle', 'dnd', 'offline'],
    default: 'offline',
  },
  customStatus: {
    type: String,
    maxlength: 128,
    default: '',
  },
  avatarColor: {
    type: String,
    default: '#4f46e5',
  },
  servers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
  }],
  // Stripe billing
  stripeCustomerId: { type: String, default: null },
  stripeAccountId: { type: String, default: null },
  subscriptionTier: { type: String, enum: ['free', 'pro', 'creator'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['active', 'cancelled', 'past_due', 'none'], default: 'none' },
  stripeSubscriptionId: { type: String, default: null },
  // Creator profile
  isCreator: { type: Boolean, default: false },
  creatorBio: { type: String, maxlength: 500, default: '' },
  // Public profile
  bio: { type: String, maxlength: 300, default: '' },
  bannerColor: { type: String, default: '#1e1b4b' },
  location: { type: String, maxlength: 64, default: '' },
  website: { type: String, maxlength: 128, default: '' },
  socialLinks: {
    twitter: { type: String, maxlength: 64, default: '' },
    github: { type: String, maxlength: 64, default: '' },
    instagram: { type: String, maxlength: 64, default: '' },
  },
  statusPost: { type: String, maxlength: 280, default: '' },
  statusPostUpdatedAt: { type: Date, default: null },
  // Moderation
  banned: [{
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
    reason: String,
    bannedAt: { type: Date, default: Date.now },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  serverMutes: [{
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
    until: Date,
    reason: String,
  }],
  dmPrivacy: {
    type: String,
    enum: ['everyone', 'friends', 'nobody'],
    default: 'everyone',
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  friends: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
    addedAt: { type: Date, default: Date.now },
  }],
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now, expires: '7d' },
  }],
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Safe public profile (no sensitive fields)
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username,
    userTag: this.userTag,
    displayName: this.displayName || this.username,
    avatar: this.avatar,
    status: this.status,
    customStatus: this.customStatus,
    avatarColor: this.avatarColor,
    bannerColor: this.bannerColor,
    bio: this.bio,
    location: this.location,
    website: this.website,
    socialLinks: this.socialLinks,
    statusPost: this.statusPost,
    statusPostUpdatedAt: this.statusPostUpdatedAt,
    subscriptionTier: this.subscriptionTier,
    createdAt: this.createdAt,
  };
};

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1, userTag: 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);
