import mongoose from 'mongoose';

const customEmojiSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 32, match: /^[a-zA-Z0-9_]+$/ },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url: { type: String, required: true },
  animated: { type: Boolean, default: false },
}, { timestamps: true });

customEmojiSchema.index({ server: 1 });

export default mongoose.model('CustomEmoji', customEmojiSchema);
