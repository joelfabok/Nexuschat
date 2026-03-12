import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import serverRoutes from './routes/servers.js';
import channelRoutes from './routes/channels.js';
import messageRoutes from './routes/messages.js';
import dmRoutes from './routes/dms.js';
import fileRoutes from './routes/files.js';
import userRoutes from './routes/users.js';
import reactionRoutes from './routes/reactions.js';
import pollRoutes from './routes/polls.js';
import eventRoutes from './routes/events.js';
import paymentRoutes from './routes/payments.js';
import moderationRoutes from './routes/moderation.js';
import analyticsRoutes from './routes/analytics.js';
import emojiRoutes from './routes/emojis.js';
import friendRoutes from './routes/friends.js';
import notificationRoutes from './routes/notifications.js';
import { initializeSocket } from './socket/socketHandler.js';
import Event from './models/Event.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Stripe webhook needs raw body BEFORE json middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

const io = new Server(httpServer, {
  cors: { origin: (_o, cb) => cb(null, true), methods: ['GET','POST'], credentials: true },
  maxHttpBufferSize: 1e7,
});

app.use(cors({ origin: (_o, cb) => cb(null, true), credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
// Remove any CSP report-only headers helmet might add
app.use((_req, res, next) => {
  res.removeHeader('Content-Security-Policy-Report-Only');
  next();
});

const limiter = rateLimit({ windowMs: 15*60*1000, max: process.env.NODE_ENV==='production' ? 200 : 2000 });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: process.env.NODE_ENV==='production' ? 20 : 500, message: { error: 'Too many auth attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dms', dmRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/emojis', emojiRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'OK', version: '2.0.0', timestamp: new Date() }));

// Production: serve frontend build
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientPath, 'index.html'));
    }
  });
}

initializeSocket(io);

// Cron: event reminders every minute
cron.schedule('* * * * *', async () => {
  try {
    const soon = new Date(Date.now() + 15 * 60 * 1000);
    const upcoming = await Event.find({ scheduledAt: { $gte: new Date(), $lte: soon }, status: 'scheduled', remindersSent: false }).populate('attendees.user', '_id');
    for (const ev of upcoming) {
      ev.attendees.filter(a => a.status === 'going').forEach(a => {
        io.to(`user:${a.user._id}`).emit('event:reminder', { eventId: ev._id, title: ev.title, scheduledAt: ev.scheduledAt, minsUntil: Math.round((ev.scheduledAt - Date.now()) / 60000) });
      });
      ev.remindersSent = true;
      await ev.save();
    }
    // Mark live
    const liveNow = await Event.find({ scheduledAt: { $lte: new Date() }, status: 'scheduled' });
    for (const ev of liveNow) {
      ev.status = 'live'; await ev.save();
      io.to(`server:${ev.server}`).emit('event:live', { eventId: ev._id, title: ev.title });
    }
  } catch (e) { console.error('Cron error:', e); }
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexus');
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 3001;
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Nexus v2 on port ${PORT} | S3:${process.env.USE_S3==='true'} | Stripe:${!!process.env.STRIPE_SECRET_KEY}`);
  });
});

export { io };
