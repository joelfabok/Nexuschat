import { useState, useEffect } from 'react';
import { CreditCard, Zap, Star, TrendingUp, ChevronRight, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    color: 'text-text-muted',
    bg: 'bg-surface-700',
    border: 'border-surface-300',
    features: ['Text & voice chat', 'Join up to 10 servers', '10MB file uploads', 'Basic emoji reactions'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    period: '/mo',
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/40',
    icon: <Zap size={14} />,
    features: ['Everything in Free', '1GB file uploads', 'Custom profile badge', 'Priority support', 'HD voice quality'],
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$12.99',
    period: '/mo',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/40',
    icon: <Star size={14} />,
    features: ['Everything in Pro', 'Accept tips & subscriptions', 'Paid events & sessions', 'Analytics dashboard', 'Revenue payouts', 'Creator badge'],
  },
];

function CheckoutForm({ clientSecret, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href } });
    if (error) { toast.error(error.message); setLoading(false); }
    else { onSuccess(); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <button type="submit" disabled={loading || !stripe} className="w-full btn-primary py-3">
        {loading ? 'Processing…' : 'Subscribe'}
      </button>
    </form>
  );
}

export default function BillingTab() {
  const [billing, setBilling] = useState(null);
  const [history, setHistory] = useState([]);
  const [clientSecret, setClientSecret] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/payments/billing'),
      api.get('/payments/history'),
    ]).then(([b, h]) => {
      setBilling(b.data);
      setHistory(h.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const subscribe = async (tier) => {
    if (!stripePromise) return toast.error('Payments not configured');
    try {
      const { data } = await api.post('/payments/subscribe', { tier });
      setClientSecret(data.clientSecret);
      setSelectedTier(tier);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start subscription');
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel your subscription?')) return;
    try {
      await api.post('/payments/cancel');
      setBilling(p => ({ ...p, subscriptionTier: 'free', subscriptionStatus: 'cancelled' }));
      toast.success('Subscription cancelled');
    } catch { toast.error('Failed to cancel'); }
  };

  if (loading) return <div className="text-center py-10 text-text-muted text-sm">Loading billing…</div>;

  if (clientSecret && stripePromise) {
    return (
      <div>
        <button onClick={() => setClientSecret(null)} className="text-sm text-brand-400 mb-4">← Back</button>
        <h3 className="font-semibold text-text-primary mb-4">Subscribe to {selectedTier}</h3>
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#6366f1' } } }}>
          <CheckoutForm clientSecret={clientSecret} onSuccess={() => {
            setClientSecret(null);
            toast.success('Subscribed!');
            setBilling(p => ({ ...p, subscriptionTier: selectedTier, subscriptionStatus: 'active' }));
          }} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="p-3 rounded-xl bg-surface-700 border border-surface-300">
        <div className="flex items-center gap-3">
          <CreditCard size={18} className="text-text-muted" />
          <div>
            <p className="text-sm font-semibold text-text-primary capitalize">
              {billing?.subscriptionTier || 'free'} plan
            </p>
            <p className="text-xs text-text-muted capitalize">{billing?.subscriptionStatus || 'none'}</p>
          </div>
          {billing?.subscriptionTier !== 'free' && (
            <button onClick={cancel} className="ml-auto text-xs text-red-400 hover:text-red-300">Cancel</button>
          )}
        </div>
      </div>

      {/* Tier cards */}
      <div className="space-y-3">
        {TIERS.map(tier => {
          const isCurrent = billing?.subscriptionTier === tier.id;
          return (
            <div key={tier.id} className={`rounded-xl border p-3 transition-all ${tier.bg} ${tier.border}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className={`flex items-center gap-1.5 font-bold text-sm ${tier.color}`}>
                    {tier.icon}{tier.name}
                    {isCurrent && <CheckCircle size={12} className="ml-1" />}
                  </div>
                  <p className="text-text-primary font-semibold text-lg">{tier.price}<span className="text-xs text-text-muted">{tier.period}</span></p>
                </div>
                {!isCurrent && tier.id !== 'free' && (
                  <button onClick={() => subscribe(tier.id)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                    Upgrade <ChevronRight size={12} />
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {tier.features.map(f => (
                  <li key={f} className="text-xs text-text-secondary flex items-center gap-1.5">
                    <CheckCircle size={10} className={tier.color} />{f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Payment History</p>
          <div className="space-y-1.5">
            {history.slice(0, 5).map(p => (
              <div key={p._id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-700 border border-surface-300 text-xs">
                <div>
                  <p className="text-text-primary capitalize">{p.type.replace('_', ' ')}</p>
                  <p className="text-text-muted">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${p.status === 'succeeded' ? 'text-status-online' : 'text-text-muted'}`}>
                    ${(p.amount / 100).toFixed(2)}
                  </p>
                  <p className="text-text-muted capitalize">{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!stripePromise && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400">
          ⚠️ Stripe is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY to enable payments.
        </div>
      )}
    </div>
  );
}
