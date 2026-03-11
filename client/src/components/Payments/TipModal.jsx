import { useState } from 'react';
import { X, Heart } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const AMOUNTS = [100, 200, 500, 1000]; // cents

function TipCheckout({ clientSecret, recipientName, amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) { toast.error(error.message); setLoading(false); }
    else { onSuccess(); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-3 rounded-xl bg-surface-700 border border-surface-300 text-center">
        <p className="text-text-muted text-xs mb-0.5">Sending tip to</p>
        <p className="font-bold text-text-primary">{recipientName}</p>
        <p className="text-2xl font-bold text-brand-400 mt-1">${(amount / 100).toFixed(2)}</p>
      </div>
      <PaymentElement />
      <button type="submit" disabled={loading || !stripe} className="w-full btn-primary py-3 flex items-center justify-center gap-2">
        <Heart size={16} /> {loading ? 'Sending…' : `Send $${(amount / 100).toFixed(2)} Tip`}
      </button>
    </form>
  );
}

export default function TipModal({ recipient, serverId, onClose }) {
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [feeInfo, setFeeInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const finalAmount = custom ? Math.round(parseFloat(custom) * 100) : amount;

  const startTip = async () => {
    if (!stripePromise) return toast.error('Payments not configured');
    if (finalAmount < 50) return toast.error('Minimum tip is $0.50');
    setLoading(true);
    try {
      const { data } = await api.post('/payments/tip', { recipientId: recipient._id, amount: finalAmount, serverId });
      setClientSecret(data.clientSecret);
      setFeeInfo(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 rounded-2xl w-full max-w-sm border border-surface-300 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-surface-300">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-red-400" />
            <span className="font-bold text-text-primary">Send a Tip</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-text-muted" /></button>
        </div>

        <div className="p-4">
          {!clientSecret ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: recipient.avatarColor || '#4f46e5' }}>
                  {(recipient.displayName || recipient.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">{recipient.displayName || recipient.username}</p>
                  <p className="text-xs text-text-muted">Creator</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustom(''); }}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${amount === a && !custom ? 'bg-brand-500 border-brand-500 text-white' : 'bg-surface-600 border-surface-300 text-text-secondary hover:border-brand-500/50'}`}>
                    ${a/100}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">$</span>
                <input type="number" placeholder="Custom amount" value={custom}
                  onChange={e => { setCustom(e.target.value); setAmount(0); }}
                  className="input-base flex-1" min="0.50" step="0.50" />
              </div>

              <p className="text-xs text-text-muted">Platform fee applies. Creator receives ~{100 - (feeInfo ? Math.round(feeInfo.platformFee / finalAmount * 100) : 15)}%</p>

              <button onClick={startTip} disabled={loading || !finalAmount} className="w-full btn-primary py-3">
                {loading ? 'Loading…' : `Continue with $${(finalAmount/100).toFixed(2)}`}
              </button>

              {!stripePromise && (
                <p className="text-xs text-yellow-400 text-center">⚠️ Stripe not configured</p>
              )}
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#6366f1' } } }}>
              <TipCheckout
                clientSecret={clientSecret}
                recipientName={recipient.displayName || recipient.username}
                amount={finalAmount}
                onSuccess={() => { toast.success('Tip sent! 🎉'); onClose(); }}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
