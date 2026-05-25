import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../database';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── One-time admin setup (only works if no admin exists) ──
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { secret, name, email, password } = req.body;
    const setupSecret = process.env.SETUP_SECRET || 'SPS_SETUP_2026';
    if (secret !== setupSecret) return res.status(403).json({ error: 'Invalid secret' });

    const admins = await query('SELECT id FROM users WHERE role = "admin" LIMIT 1', []);
    if (admins.length > 0) return res.status(400).json({ error: 'Admin already exists' });

    const hash = bcrypt.hashSync(password, 12);
    await execute(
      `INSERT INTO users (id, name, email, password_hash, role, phone, is_active) VALUES (?, ?, ?, ?, 'admin', '', 1)`,
      [uuidv4(), name, email, hash]
    );
    return res.json({ message: 'Admin created!', email, password });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await queryOne<any>('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await queryOne<any>('SELECT id, name, email, role, phone, is_active FROM users WHERE id = ?', [req.user!.id]);
    return res.json(user);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, phone, address } = req.body;
    await execute('UPDATE users SET name = ?, phone = ?, address = ?, updated_at = NOW() WHERE id = ?', [name, phone, address, req.user!.id]);
    return res.json({ message: 'Profile updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.id]);
    return res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
