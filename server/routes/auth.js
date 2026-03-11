import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { generateTokens, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Generate a unique 4-digit tag for a username
async function generateUserTag(username) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tag = String(Math.floor(1000 + Math.random() * 9000));
    const exists = await User.findOne({ username, userTag: tag });
    if (!exists) return tag;
  }
  // Fallback: random 6-digit
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Register
router.post('/register', [
  body('username').trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_.-]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password, displayName } = req.body;
  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(409).json({ error: existing.email === email ? 'Email already registered' : 'Username taken' });

    const userTag = await generateUserTag(username);
    const user = await User.create({ username, email, password, displayName: displayName || username, userTag });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.status(201).json({ user: user.toPublicProfile(), accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user._id);
    if (user.refreshTokens.length >= 5) user.refreshTokens.shift();
    user.refreshTokens.push({ token: refreshToken });
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    res.json({ user: user.toPublicProfile(), accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.json({ message: 'Password changed', accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
  try {
    const { default: jwt } = await import('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const tokenIndex = user.refreshTokens.findIndex(t => t.token === refreshToken);
    if (tokenIndex === -1) return res.status(401).json({ error: 'Invalid refresh token' });
    const tokens = generateTokens(user._id);
    user.refreshTokens.splice(tokenIndex, 1, { token: tokens.refreshToken });
    await user.save();
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  try {
    req.user.refreshTokens = req.user.refreshTokens.filter(t => t.token !== refreshToken);
    req.user.status = 'offline';
    req.user.lastSeen = new Date();
    await req.user.save();
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).populate('servers', 'name icon');
  res.json(user.toPublicProfile());
});

export default router;
