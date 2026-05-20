import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '../database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const staff = await query<any>(`
      SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
             COUNT(DISTINCT ce.id) as assigned_centers,
             COUNT(DISTINCT col.id) as total_collections,
             COALESCE(SUM(col.amount), 0) as total_amount,
             COALESCE(SUM(CASE WHEN col.payment_date = ? THEN col.amount ELSE 0 END), 0) as today_amount,
             COALESCE(SUM(CASE WHEN col.payment_date >= ? THEN col.amount ELSE 0 END), 0) as month_amount
      FROM users u
      LEFT JOIN centers ce ON ce.staff_id = u.id AND ce.is_active = 1
      LEFT JOIN collections col ON col.collected_by = u.id
      WHERE u.role = 'staff'
      GROUP BY u.id
      ORDER BY u.name
    `, [today, monthStart]);

    return res.json(staff);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const staff = await queryOne<any>(`
      SELECT id, name, email, phone, address, is_active, created_at
      FROM users WHERE id = ? AND role = 'staff'
    `, [req.params.id]);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const centers = await query<any>('SELECT * FROM centers WHERE staff_id = ? AND is_active = 1', [req.params.id]);
    const recentCollections = await query<any>(`
      SELECT col.*, cu.name as customer_name, l.loan_no
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      WHERE col.collected_by = ?
      ORDER BY col.created_at DESC LIMIT 20
    `, [req.params.id]);

    return res.json({ ...staff, centers, recentCollections });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });

    const existing = await queryOne<any>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    await execute(`
      INSERT INTO users (id, name, email, password_hash, role, phone, address)
      VALUES (?, ?, ?, ?, 'staff', ?, ?)
    `, [id, name, email, hash, phone, address]);

    return res.status(201).json({ id, message: 'Staff created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, phone, address, is_active } = req.body;
    await execute('UPDATE users SET name=?, phone=?, address=?, is_active=? WHERE id=?',
      [name, phone, address, is_active !== undefined ? is_active : 1, req.params.id]);
    return res.json({ message: 'Staff updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reset-password', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });
    const hash = bcrypt.hashSync(password, 10);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    return res.json({ message: 'Password reset' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
