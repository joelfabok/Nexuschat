# Nexus Chat v2

A scalable community platform combining Discord-style communication, watch parties, embedded livestreams, and creator monetization.

## Features

- **Real-time chat** — text channels, DMs, typing indicators, reactions, polls
- **Voice channels** — WebRTC P2P audio, speaking indicators, mute/deafen
- **Watch parties** — sync YouTube/Twitch/Kick with voice, comment feed, reactions  
- **Screen sharing** — P2P screen share in voice channels
- **Events** — schedule voice/watch sessions, RSVP, reminders, live notifications
- **Reactions** — emoji reactions on every message
- **Polls** — live polls inside channels with real-time vote updates
- **Custom emoji** — servers can upload custom emoji (admin only)
- **Payments** — Stripe tips, platform subscriptions (Pro/Creator), paid events
- **Moderation** — mute/kick/ban, message deletion, reports queue
- **Analytics** — message stats, top channels, top members (server owners)
- **PWA** — installable as a mobile app, offline UI caching
- **File uploads** — chunked uploads up to 1GB, S3/R2 or local storage

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT (access + refresh tokens) + bcrypt
- **Payments**: Stripe
- **Storage**: Local disk (default) or S3/Cloudflare R2
- **PWA**: Workbox via vite-plugin-pwa

## Local Development

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit both .env files

# 3. Start backend (port 3001)
cd server && npm run dev

# 4. Start frontend (port 5173)
cd client && npm run dev
```

### Phone Testing (HTTPS required for microphone)

```bash
# Install cloudflared
brew install cloudflared

# Terminal 1: tunnel backend
cloudflared tunnel --url http://localhost:3001
# Copy the https://xxx.trycloudflare.com URL → set as VITE_BACKEND_URL in client/.env

# Terminal 2: tunnel frontend  
cloudflared tunnel --url http://localhost:5173
# Open this URL on your phone
```

## Deployment to Render

### 1. MongoDB Atlas
- Create free M0 cluster at mongodb.com
- Get connection string: `mongodb+srv://...`

### 2. Push to GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin <your-repo>
git push -u origin main
```

### 3. Render Web Service
- **Root Directory**: `server`
- **Build Command**: `npm install && npm install --prefix ../client && npm run build --prefix ../client`
- **Start Command**: `npm start`

### 4. Environment Variables on Render
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<random 64 char string>
JWT_REFRESH_SECRET=<another random string>
CLIENT_URL=https://your-app.onrender.com
PORT=3001

# Optional: Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_CREATOR_PRICE_ID=price_...
PLATFORM_FEE_PCT=15

# Optional: Cloudflare R2 or S3
USE_S3=true
S3_BUCKET=nexus-uploads
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://pub-xxx.r2.dev
S3_PUBLIC_BUCKET=true
```

### 5. Stripe Setup
1. Create products in Stripe Dashboard:
   - "Nexus Pro" — $4.99/month recurring → get `price_xxx` → set as `STRIPE_PRO_PRICE_ID`
   - "Nexus Creator" — $12.99/month → `STRIPE_CREATOR_PRICE_ID`
2. Add webhook endpoint: `https://your-app.onrender.com/api/payments/webhook`
   - Events: `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.deleted`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 6. Free Tier Anti-Sleep (Render)
Add UptimeRobot to ping `https://your-app.onrender.com/api/health` every 10 minutes.

## Architecture Notes

- Chunked file upload (5MB chunks → server reassembles)
- Stripe webhooks confirm payment server-side (never store card data)
- Event reminders via node-cron (runs every minute, sends 15-min warning)
- PWA service worker caches UI assets for offline shell
- WebRTC is P2P — suitable for small groups (< 15 people); for scale, use a media server (mediasoup, LiveKit)
# Nexuschat
