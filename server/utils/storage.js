import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Works with AWS S3, Cloudflare R2, or any S3-compatible storage
// Set USE_S3=true in env to enable; falls back to local disk

const USE_S3 = process.env.USE_S3 === 'true';

let s3Client = null;
if (USE_S3) {
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined, // for R2: https://<accountid>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // needed for some providers
  });
}

const BUCKET = process.env.S3_BUCKET || 'nexus-uploads';
const PUBLIC_URL = process.env.S3_PUBLIC_URL || ''; // CDN or public bucket URL

/**
 * Upload a buffer to S3/R2.
 * Returns a public URL string.
 */
export async function uploadToS3(buffer, originalName, mimetype, folder = 'uploads') {
  if (!USE_S3 || !s3Client) {
    throw new Error('S3 not configured');
  }
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    // For public buckets; remove if using presigned URLs
    ACL: process.env.S3_PUBLIC_BUCKET === 'true' ? 'public-read' : undefined,
  }));

  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${key}`;
  }
  // Presigned URL valid for 7 days (for private buckets)
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 604800 });
}

/**
 * Delete a file from S3 by its key (last path segment works if using CDN URLs)
 */
export async function deleteFromS3(urlOrKey) {
  if (!USE_S3 || !s3Client) return;
  let key = urlOrKey;
  if (urlOrKey.startsWith('http')) {
    // Extract key from URL
    const urlPath = new URL(urlOrKey).pathname;
    key = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  }
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('S3 delete error:', err);
  }
}

/**
 * Generate a presigned upload URL for direct client-side uploads.
 * Client uploads directly to S3, server just validates after.
 */
export async function getPresignedUploadUrl(filename, mimetype, folder = 'uploads') {
  if (!USE_S3 || !s3Client) throw new Error('S3 not configured');
  const ext = path.extname(filename);
  const key = `${folder}/${uuidv4()}${ext}`;

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: mimetype }),
    { expiresIn: 3600 }
  );

  const publicUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;
  return { uploadUrl: url, key, publicUrl };
}

export { USE_S3 };
