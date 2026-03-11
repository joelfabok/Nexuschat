import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
}, { timestamps: true });

// One pending request between any two users at a time
friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });
friendRequestSchema.index({ recipient: 1, status: 1 });

export default mongoose.model('FriendRequest', friendRequestSchema);
