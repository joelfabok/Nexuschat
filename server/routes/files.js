import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_DIR  = path.join(__dirname, '..', 'uploads', '.chunks');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CHUNK_DIR))  fs.mkdirSync(CHUNK_DIR,  { recursive: true });

const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB
const CHUNK_SIZE    = 5 * 1024 * 1024;         // 5 MB per chunk

// ── Multer for small files (≤ 10 MB) and individual chunks ────────────────────
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHUNK_DIR),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}.part`),
});

const upload = multer({
  storage: chunkStorage,
  limits: { fileSize: CHUNK_SIZE + 1024 }, // chunk + a little headroom
});

// Allowed MIME types
const ALLOWED = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'video/mp4','video/webm','video/quicktime',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4',
  'application/pdf','text/plain',
  'application/zip','application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword','application/vnd.ms-excel',
]);

// ── POST /files/chunk  ────────────────────────────────────────────────────────
// Body fields (multipart): uploadId, chunkIndex, totalChunks, filename, mimetype
// File field: chunk
router.post('/chunk', authenticate, upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename, mimetype, totalSize } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !filename) {
      fs.unlinkSync(req.file.path); // clean up orphaned chunk
      return res.status(400).json({ error: 'Missing chunk metadata' });
    }

    if (!ALLOWED.has(mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `File type not allowed: ${mimetype}` });
    }

    if (Number(totalSize) > MAX_FILE_SIZE) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File too large (max 1 GB)' });
    }

    // Move chunk to a named slot so we can reassemble in order
    const chunkPath = path.join(CHUNK_DIR, `${uploadId}_${chunkIndex}`);
    fs.renameSync(req.file.path, chunkPath);

    const idx     = Number(chunkIndex);
    const total   = Number(totalChunks);
    const isLast  = idx === total - 1;

    if (!isLast) {
      return res.json({ received: idx, total });
    }

    // ── All chunks received — assemble ──────────────────────────────────────
    const userDir = path.join(UPLOAD_DIR, req.user._id.toString());
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    const ext      = path.extname(filename);
    const finalName = `${uuidv4()}${ext}`;
    const finalPath = path.join(userDir, finalName);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < total; i++) {
      const p = path.join(CHUNK_DIR, `${uploadId}_${i}`);
      const data = fs.readFileSync(p);
      writeStream.write(data);
      fs.unlinkSync(p); // clean up chunk immediately
    }

    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(finalPath);
    res.json({
      filename:     finalName,
      originalName: filename,
      mimetype,
      size:         stats.size,
      url:          `/uploads/${req.user._id}/${finalName}`,
    });
  } catch (err) {
    console.error('Chunk upload error:', err);
    res.status(500).json({ error: 'Chunk upload failed' });
  }
});

// ── DELETE /files/chunk/:uploadId  — cancel / clean up orphaned chunks ────────
router.delete('/chunk/:uploadId', authenticate, (req, res) => {
  const { uploadId } = req.params;
  try {
    const files = fs.readdirSync(CHUNK_DIR).filter(f => f.startsWith(uploadId));
    files.forEach(f => fs.unlinkSync(path.join(CHUNK_DIR, f)));
    res.json({ cancelled: files.length });
  } catch {
    res.json({ cancelled: 0 });
  }
});

export default router;
