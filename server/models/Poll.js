import mongoose from 'mongoose';

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 500 },
  options: [{
    text: { type: String, required: true, maxlength: 200 },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  }],
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  multiChoice: { type: Boolean, default: false },
  endsAt: { type: Date, default: null },
  closed: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Poll', pollSchema);
