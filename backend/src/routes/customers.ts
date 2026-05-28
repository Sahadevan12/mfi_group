import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { query, queryOne, execute } from '../database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// OTP — Send
router.post('/send-otp', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile required' });

    const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id = ?', ['default']);
    const apiKey = settings?.otp_api_key || settings?.api_key;
    if (!apiKey) return res.status(400).json({ error: 'OTP API key not configured' });

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    const res2f = await axios.get(
      `https://2factor.in/API/V1/${apiKey}/SMS/${cleanMobile}/AUTOGEN`,
      { timeout: 10000 }
    );

    if (res2f.data?.Status === 'Success') {
      return res.json({ success: true, session: res2f.data.Details });
    }
    return res.status(400).json({ error: res2f.data?.Details || 'Failed to send OTP' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// OTP — Verify
router.post('/verify-otp', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const { session, otp } = req.body;
    if (!session || !otp) return res.status(400).json({ error: 'Session and OTP required' });

    const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id = ?', ['default']);
    const apiKey = settings?.otp_api_key || settings?.api_key;

    const res2f = await axios.get(
      `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${session}/${otp}`,
      { timeout: 10000 }
    );

    const success = res2f.data?.Status === 'Success';
    return res.json({ success, message: res2f.data?.Details });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { search, center_id, group_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: any[] = [];

    let where = 'WHERE cu.is_active = 1';
    if (search) { where += ' AND (cu.name LIKE ? OR cu.mobile LIKE ? OR cu.aadhaar LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (center_id) { where += ' AND cu.center_id = ?'; params.push(center_id); }
    if (group_id) { where += ' AND cu.group_id = ?'; params.push(group_id); }

    if (req.user!.role === 'staff') {
      where += ` AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ?)`;
      params.push(req.user!.id);
    }

    const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM customers cu ${where}`, params);
    const total = countRow?.c || 0;

    const customers = await query<any>(`
      SELECT cu.*, ce.name as center_name, g.name as group_name,
             COUNT(DISTINCT l.id) as total_loans,
             COUNT(DISTINCT CASE WHEN l.status='active' THEN l.id END) as active_loans
      FROM customers cu
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      LEFT JOIN loans l ON l.customer_id = cu.id
      ${where}
      GROUP BY cu.id
      ORDER BY cu.name
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit as string), offset]);

    return res.json({ customers, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>(`
      SELECT cu.*, ce.name as center_name, g.name as group_name
      FROM customers cu
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE cu.id = ?
    `, [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const loans = await query<any>(`
      SELECT l.*, u.name as approved_by_name
      FROM loans l
      LEFT JOIN users u ON l.approved_by = u.id
      WHERE l.customer_id = ?
      ORDER BY l.created_at DESC
    `, [req.params.id]);

    const collections = await query<any>(`
      SELECT col.*, u.name as collected_by_name
      FROM collections col
      JOIN users u ON col.collected_by = u.id
      WHERE col.customer_id = ?
      ORDER BY col.payment_date DESC LIMIT 20
    `, [req.params.id]);

    const documents = await query<any>(`
      SELECT d.*, u.name as uploaded_by_name
      FROM customer_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
    `, [req.params.id]);

    return res.json({ ...customer, loans, collections, documents });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const {
      name, mobile, alt_mobile, address, city, state, pincode,
      aadhaar, pan, dob, gender, photo,
      nominee_name, nominee_relation, nominee_mobile,
      guarantor_name, guarantor_mobile, guarantor_address,
      center_id, group_id
    } = req.body;

    if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile required' });
    if (!dob)     return res.status(400).json({ error: 'Date of Birth is required' });
    if (!gender)  return res.status(400).json({ error: 'Gender is required' });
    if (!aadhaar) return res.status(400).json({ error: 'Aadhaar number is required' });

    if (!address) return res.status(400).json({ error: 'Address is required' });

    // Check duplicate mobile
    const cleanMobile = mobile.replace(/\D/g, '');
    const existing = await queryOne<any>(
      'SELECT id, name FROM customers WHERE mobile = ? AND is_active = 1',
      [cleanMobile]
    );
    if (existing) {
      return res.status(400).json({
        error: `Mobile number already registered under customer "${existing.name}"`
      });
    }

    const id = uuidv4();
    await execute(`
      INSERT INTO customers (id, name, mobile, alt_mobile, address, city, state, pincode,
        aadhaar, pan, dob, gender, photo, nominee_name, nominee_relation, nominee_mobile,
        guarantor_name, guarantor_mobile, guarantor_address, center_id, group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, mobile,
      alt_mobile || null, address, city || null, state || null, pincode || null,
      aadhaar, pan, dob, gender, photo || null,
      nominee_name || null, nominee_relation || null, nominee_mobile || null,
      guarantor_name || null, guarantor_mobile || null, guarantor_address || null,
      center_id || null, group_id || null, req.user!.id]);

    return res.status(201).json({ id, message: 'Customer created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const {
      name, mobile, alt_mobile, address, city, state, pincode,
      aadhaar, pan, dob, gender, photo,
      nominee_name, nominee_relation, nominee_mobile,
      guarantor_name, guarantor_mobile, guarantor_address,
      center_id, group_id
    } = req.body;

    await execute(`
      UPDATE customers SET name=?, mobile=?, alt_mobile=?, address=?, city=?, state=?, pincode=?,
        aadhaar=?, pan=?, dob=?, gender=?, photo=?, nominee_name=?, nominee_relation=?,
        nominee_mobile=?, guarantor_name=?, guarantor_mobile=?, guarantor_address=?,
        center_id=?, group_id=? WHERE id=?
    `, [name, mobile, alt_mobile || null, address, city || null, state || null, pincode || null,
      aadhaar || null, pan || null, dob || null, gender || null, photo || null,
      nominee_name || null, nominee_relation || null, nominee_mobile || null,
      guarantor_name || null, guarantor_mobile || null, guarantor_address || null,
      center_id || null, group_id || null, req.params.id]);

    return res.json({ message: 'Customer updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const row = await queryOne<any>("SELECT COUNT(*) as c FROM loans WHERE customer_id = ? AND status = 'active'", [req.params.id]);
    if (row?.c > 0) return res.status(400).json({ error: 'Cannot deactivate customer with active loans' });
    await execute('UPDATE customers SET is_active = 0 WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Customer deactivated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/create-portal', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const existing = await queryOne<any>('SELECT id FROM users WHERE id = ? OR email = ?', [
      customer.user_id, `${customer.mobile}@portal.local`
    ]);
    if (existing) return res.status(400).json({ error: 'Portal access already exists' });

    const userId = uuidv4();
    const password = customer.mobile.slice(-4);
    const hash = bcrypt.hashSync(password, 10);
    const email = `${customer.mobile}@portal.local`;

    await execute(`
      INSERT INTO users (id, name, email, password_hash, role, phone, is_active)
      VALUES (?, ?, ?, ?, 'customer', ?, 1)
    `, [userId, customer.name, email, hash, customer.mobile]);

    await execute('UPDATE customers SET user_id = ? WHERE id = ?', [userId, customer.id]);

    return res.json({ message: 'Portal access created', login: customer.mobile, password });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
