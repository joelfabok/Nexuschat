import mongoose from 'mongoose';

// Tracks Stripe payments: tips, subscriptions, event tickets
const paymentSchema = new mongoose.Schema({
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = platform
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', default: null },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  type: {
    type: String,
    enum: ['tip', 'subscription', 'event_ticket', 'platform_sub'],
    required: true,
  },
  amount: { type: Number, required: true },         // in cents
  platformFee: { type: Number, default: 0 },        // in cents
  creatorAmount: { type: Number, default: 0 },      // in cents
  currency: { type: String, default: 'usd' },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'refunded'],
    default: 'pending',
  },
  // Stripe references
  stripePaymentIntentId: { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  stripeTransferId: { type: String, default: null },
  stripeInvoiceId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

paymentSchema.index({ payer: 1, createdAt: -1 });
paymentSchema.index({ recipient: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });

export default mongoose.model('Payment', paymentSchema);
