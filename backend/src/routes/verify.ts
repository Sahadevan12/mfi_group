import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { queryOne } from '../database';
import { sendSMS } from '../services/smsService';

const router = Router();

interface OTPEntry {
  otp: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
}

// In-memory OTP store  { mobile → OTPEntry }
const otpStore = new Map<string, OTPEntry>();

// Clean up expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [mobile, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) otpStore.delete(mobile);
  }
}, 15 * 60 * 1000);

// POST /api/verify/send-otp
router.post('/send-otp', authenticate, async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    const clean = (mobile || '').replace(/\D/g, '');

    if (!clean || clean.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }

    // Rate-limit: don't resend within 60 seconds
    const existing = otpStore.get(clean);
    if (existing && Date.now() < existing.expiresAt - 9 * 60 * 1000) {
      const waitSec = Math.ceil((existing.expiresAt - 9 * 60 * 1000 - Date.now()) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSec}s before resending` });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(clean, { otp, expiresAt: Date.now() + 10 * 60 * 1000, verified: false, attempts: 0 });

    const message = `Your SPS Group verification code is ${otp}. Valid for 10 minutes. Do not share with anyone.`;

    // Check if SMS provider is configured
    const settings = await queryOne<any>('SELECT is_active, api_key FROM sms_settings WHERE id = ?', ['default']);
    const smsConfigured = !!(settings?.is_active && settings?.api_key);

    await sendSMS(null, clean, message, 'otp_verification');

    if (smsConfigured) {
      // Real SMS sent — don't expose OTP
      return res.json({ sent: true, demo: false, message: `OTP sent to ${clean.slice(0, 5)}XXXXX` });
    } else {
      // SMS not configured — return OTP for demo/testing
      console.log(`[OTP DEMO] ${clean} → ${otp}`);
      return res.json({ sent: true, demo: true, otp, message: `Demo mode: SMS not configured` });
    }
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/verify/verify-otp
router.post('/verify-otp', authenticate, async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;
    const clean = (mobile || '').replace(/\D/g, '');

    if (!clean || !otp) {
      return res.status(400).json({ error: 'Mobile and OTP required' });
    }

    const entry = otpStore.get(clean);
    if (!entry) {
      return res.status(400).json({ error: 'OTP not sent or expired. Click Send OTP first.' });
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(clean);
      return res.status(400).json({ error: 'OTP expired. Please send again.' });
    }

    // Max 5 wrong attempts
    if (entry.attempts >= 5) {
      otpStore.delete(clean);
      return res.status(400).json({ error: 'Too many wrong attempts. Please send a new OTP.' });
    }

    if (entry.otp !== otp.trim()) {
      entry.attempts += 1;
      const remaining = 5 - entry.attempts;
      return res.status(400).json({ error: `Wrong OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` });
    }

    // Mark verified
    entry.verified = true;
    return res.json({ verified: true, message: 'Mobile number verified successfully' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
