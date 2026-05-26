import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { queryOne } from '../database';
import { sendSMS } from '../services/smsService';
import axios from 'axios';

const router = Router();

interface OTPEntry {
  otp: string;
  session?: string;       // 2Factor session id
  expiresAt: number;
  verified: boolean;
  attempts: number;
  provider: 'twofactor' | 'sms';
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

    const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id = ?', ['default']);
    // Fall back to environment variable if DB not yet configured
    const otpApiKey = settings?.otp_api_key || process.env.APITXT_OTP_KEY;
    const otpProvider = settings?.otp_provider || (process.env.APITXT_OTP_KEY ? 'apitxt' : 'twofactor');

    // ── apitxt OTP (we generate OTP, apitxt sends SMS) ──
    if (otpApiKey && otpProvider === 'apitxt') {
      try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const resA = await axios.get('https://apitxt.com/api/sendOTP', {
          params: { authkey: otpApiKey, mobile: '91' + clean, otp },
          timeout: 10000,
        });
        console.log('[apitxt OTP] Response:', JSON.stringify(resA.data));
        if (resA.data?.type === 'success' || resA.status === 200) {
          otpStore.set(clean, {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000,
            verified: false, attempts: 0,
            provider: 'sms',  // server-side verify, no session needed
          });
          return res.json({ sent: true, demo: false, message: `OTP sent to ${clean.slice(0, 5)}XXXXX` });
        }
        console.error('[apitxt OTP] Failed:', resA.data);
      } catch (e: any) {
        console.error('[apitxt OTP] Error:', e.message);
        // Fall through to fallback
      }
    }

    // ── 2Factor native OTP (session-based verify) ──
    if (otpApiKey && otpProvider === 'twofactor') {
      try {
        const res2f = await axios.get(
          `https://2factor.in/API/V1/${otpApiKey}/SMS/${clean}/AUTOGEN`,
          { timeout: 10000 }
        );
        if (res2f.data?.Status === 'Success') {
          const session = res2f.data.Details;
          otpStore.set(clean, {
            otp: '', session,
            expiresAt: Date.now() + 10 * 60 * 1000,
            verified: false, attempts: 0,
            provider: 'twofactor',
          });
          return res.json({ sent: true, demo: false, message: `OTP sent to ${clean.slice(0, 5)}XXXXX` });
        }
      } catch (e: any) {
        console.error('[2Factor OTP] Error:', e.message);
        // Fall through to fallback
      }
    }

    // ── Fallback — generate OTP and send via main SMS provider ──
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(clean, {
      otp, expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false, attempts: 0, provider: 'sms',
    });

    const message = `Your SPS Group verification code is ${otp}. Valid for 10 minutes. Do not share.`;
    const smsConfigured = !!(settings?.is_active && settings?.api_key) || !!process.env.APITXT_OTP_KEY;
    await sendSMS(null, clean, message, 'otp_verification');

    if (smsConfigured) {
      return res.json({ sent: true, demo: false, message: `OTP sent to ${clean.slice(0, 5)}XXXXX` });
    } else {
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

    // 2Factor native verify
    if (entry.provider === 'twofactor' && entry.session) {
      try {
        const settings = await queryOne<any>('SELECT otp_api_key FROM sms_settings WHERE id = ?', ['default']);
        const res2f = await axios.get(
          `https://2factor.in/API/V1/${settings?.otp_api_key}/SMS/VERIFY/${entry.session}/${otp.trim()}`,
          { timeout: 10000 }
        );
        if (res2f.data?.Status === 'Success') {
          entry.verified = true;
          otpStore.delete(clean);
          return res.json({ verified: true, message: 'Mobile number verified successfully' });
        } else {
          entry.attempts += 1;
          const remaining = 5 - entry.attempts;
          return res.status(400).json({ error: `Wrong OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` });
        }
      } catch (e: any) {
        return res.status(500).json({ error: 'Verification failed: ' + e.message });
      }
    }

    // Fallback SMS OTP verify
    if (entry.otp !== otp.trim()) {
      entry.attempts += 1;
      const remaining = 5 - entry.attempts;
      return res.status(400).json({ error: `Wrong OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` });
    }

    entry.verified = true;
    otpStore.delete(clean);
    return res.json({ verified: true, message: 'Mobile number verified successfully' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
