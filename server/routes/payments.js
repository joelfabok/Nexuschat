import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createTipIntent, createSubscription, cancelSubscription, handleWebhook, PLATFORM_FEE_PCT, stripe } from '../utils/stripe.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';

const router = express.Router();

// Get billing info for current user
router.get('/billing', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      hasPaymentMethod: !!user.stripeCustomerId,
      platformFeePct: PLATFORM_FEE_PCT,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

// Get payment history
router.get('/history', authenticate, async (req, res) => {
  try {
    const payments = await Payment.find({ $or: [{ payer: req.user._id }, { recipient: req.user._id }] })
      .populate('payer', 'username displayName avatarColor')
      .populate('recipient', 'username displayName avatarColor')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Create tip payment intent
router.post('/tip', authenticate, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
    const { recipientId, amount, serverId } = req.body;
    if (!recipientId || !amount || amount < 50) {
      return res.status(400).json({ error: 'recipientId and amount (min $0.50) required' });
    }
    const recipient = await User.findById(recipientId);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const result = await createTipIntent(req.user, recipient, amount, serverId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Subscribe to platform tier
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
    const { tier } = req.body;
    if (!['pro', 'creator'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
    const result = await createSubscription(req.user, tier);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
    await cancelSubscription(req.user);
    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook — must be raw body
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    await handleWebhook(req.body, sig);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
