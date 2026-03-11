import Stripe from 'stripe';
import User from '../models/User.js';
import Payment from '../models/Payment.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// Platform fee percentage (e.g. 15 = 15%)
export const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT) || 15;

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(user) {
  if (!stripe) throw new Error('Stripe not configured');
  if (user.stripeCustomerId) {
    return stripe.customers.retrieve(user.stripeCustomerId);
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.displayName || user.username,
    metadata: { userId: user._id.toString() },
  });
  await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });
  return customer;
}

/**
 * Create a payment intent for a one-time tip
 * amount: cents
 */
export async function createTipIntent(payer, recipient, amountCents, serverId = null) {
  if (!stripe) throw new Error('Stripe not configured');
  const customer = await getOrCreateCustomer(payer);
  const platformFee = Math.round(amountCents * PLATFORM_FEE_PCT / 100);
  const creatorAmount = amountCents - platformFee;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customer.id,
    metadata: {
      type: 'tip',
      payerId: payer._id.toString(),
      recipientId: recipient._id.toString(),
      serverId: serverId?.toString() || '',
    },
    description: `Tip to ${recipient.displayName || recipient.username}`,
  });

  // Record pending payment
  await Payment.create({
    payer: payer._id,
    recipient: recipient._id,
    server: serverId,
    type: 'tip',
    amount: amountCents,
    platformFee,
    creatorAmount,
    status: 'pending',
    stripePaymentIntentId: paymentIntent.id,
  });

  return { clientSecret: paymentIntent.client_secret, platformFee, creatorAmount };
}

/**
 * Create or retrieve subscription plans (call once at startup if plans don't exist)
 */
export const PLAN_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || null,
  creator: process.env.STRIPE_CREATOR_PRICE_ID || null,
};

/**
 * Subscribe a user to a platform tier
 */
export async function createSubscription(user, tier) {
  if (!stripe) throw new Error('Stripe not configured');
  const priceId = PLAN_IDS[tier];
  if (!priceId) throw new Error(`No price ID configured for tier: ${tier}`);
  const customer = await getOrCreateCustomer(user);

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId: user._id.toString(), tier },
  });

  await User.findByIdAndUpdate(user._id, {
    stripeSubscriptionId: subscription.id,
    subscriptionTier: tier,
    subscriptionStatus: 'active',
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
  };
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(user) {
  if (!stripe || !user.stripeSubscriptionId) throw new Error('No subscription found');
  await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  await User.findByIdAndUpdate(user._id, {
    stripeSubscriptionId: null,
    subscriptionTier: 'free',
    subscriptionStatus: 'cancelled',
  });
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(rawBody, signature) {
  if (!stripe) throw new Error('Stripe not configured');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'succeeded' }
      );
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'failed' }
      );
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await User.findOneAndUpdate(
          { stripeSubscriptionId: invoice.subscription },
          { subscriptionStatus: 'active' }
        );
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await User.findOneAndUpdate(
          { stripeSubscriptionId: invoice.subscription },
          { subscriptionStatus: 'past_due' }
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        { subscriptionStatus: 'cancelled', subscriptionTier: 'free', stripeSubscriptionId: null }
      );
      break;
    }
  }

  return event;
}

export { stripe };
