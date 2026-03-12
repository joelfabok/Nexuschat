import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
});

export async function sendPasswordResetEmail(to, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const text = `You requested a password reset for your Nexus account.\n\n` +
    `Click the link to set a new password:\n${resetUrl}\n\n` +
    `If you did not request this, ignore this email.`;

  const html = `
    <p>You requested a password reset for your Nexus account.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you did not request this, ignore this email.</p>
  `;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email provider not configured; password reset token:', token);
    return { info: 'no-email-send', resetUrl };
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@nexuschat.com',
    to,
    subject: 'Nexus Password Reset',
    text,
    html,
  });
}
