import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import CustomEmoji from '../models/CustomEmoji.js';
import Server from '../models/Server.js';
import { USE_S3, uploadToS3 } from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const EMOJI_DIR = path.join(__dirname, '..', 'uploads', 'emoji');
if (!fs.existsSync(EMOJI_DIR)) fs.mkdirSync(EMOJI_DIR, { recursive: true });

const emojiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 }, // 256KB max per emoji
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Get all emojis for a server
router.get('/:serverId', authenticate, async (req, res) => {
  try {
    const emojis = await CustomEmoji.find({ server: req.params.serverId })
      .populate('uploadedBy', 'username displayName');
    res.json(emojis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emojis' });
  }
});

// Upload a custom emoji
router.post('/:serverId', authenticate, emojiUpload.single('emoji'), async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const member = server.members.find(m => m.user.equals(req.user._id));
    if (!member || !['admin', 'owner'].includes(member.role)) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { name } = req.body;
    if (!name || !/^[a-zA-Z0-9_]{1,32}$/.test(name)) {
      return res.status(400).json({ error: 'Invalid emoji name (alphanumeric, underscores, 1-32 chars)' });
    }

    let url;
    if (USE_S3) {
      url = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'emoji');
    } else {
      const ext = path.extname(req.file.originalname);
      const filename = `${uuidv4()}${ext}`;
      fs.writeFileSync(path.join(EMOJI_DIR, filename), req.file.buffer);
      url = `/uploads/emoji/${filename}`;
    }

    const emoji = await CustomEmoji.create({
      name, server: req.params.serverId,
      uploadedBy: req.user._id, url,
      animated: req.file.mimetype === 'image/gif',
    });

    res.json(emoji);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload emoji' });
  }
});

// Delete emoji
router.delete('/:serverId/:emojiId', authenticate, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ error: 'Not found' });
    const member = server.members.find(m => m.user.equals(req.user._id));
    if (!member || !['admin', 'owner'].includes(member.role)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    await CustomEmoji.findByIdAndDelete(req.params.emojiId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete emoji' });
  }
});

export default router;
