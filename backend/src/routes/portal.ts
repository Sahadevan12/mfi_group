import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../database';
import { authenticate } from '../middleware/auth';

const router = Router();

function requireCustomer(req: Request, res: Response, next: Function) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access only' });
  next();
}

// ── Customer login by mobile number ──
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

    const customer = await queryOne<any>(
      'SELECT id, name, mobile FROM customers WHERE mobile = ? AND is_active = 1',
      [String(mobile).trim()]
    );
    if (!customer) return res.status(404).json({ error: 'Mobile number not registered' });

    const token = jwt.sign(
      { id: customer.id, role: 'customer', name: customer.name, email: '' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: { id: customer.id, name: customer.name, role: 'customer', mobile: customer.mobile },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/profile', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>(`
      SELECT cu.*, ce.name as center_name, g.name as group_name
      FROM customers cu
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE cu.id = ?
    `, [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Profile not found' });
    return res.json(customer);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/loans', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const loans = await query<any>(`
      SELECT l.*, u.name as approved_by_name
      FROM loans l
      LEFT JOIN users u ON l.approved_by = u.id
      WHERE l.customer_id = ?
      ORDER BY l.created_at DESC
    `, [customer.id]);

    return res.json(loans);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/loans/:loanId/schedule', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const loan = await queryOne<any>('SELECT id FROM loans WHERE id = ? AND customer_id = ?', [req.params.loanId, customer.id]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const schedule = await query<any>(`
      SELECT ls.*, col.receipt_no, col.payment_date as actual_paid_date, col.payment_mode
      FROM loan_schedule ls
      LEFT JOIN collections col ON col.schedule_id = ls.id
      WHERE ls.loan_id = ?
      ORDER BY ls.installment_no
    `, [req.params.loanId]);

    return res.json(schedule);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/payments', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const { loan_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: any[] = [customer.id];
    let loanFilter = '';
    if (loan_id) { loanFilter = ' AND col.loan_id = ?'; params.push(loan_id); }

    const payments = await query<any>(`
      SELECT col.id, col.receipt_no, col.amount, col.penalty_paid,
             col.payment_date, col.payment_mode, col.payment_type,
             l.loan_no, u.name as collected_by_name
      FROM collections col
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      WHERE col.customer_id = ? ${loanFilter}
      ORDER BY col.payment_date DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit as string), offset]);

    return res.json(payments);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/receipt/:collectionId', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const receipt = await queryOne<any>(`
      SELECT col.*, cu.name as customer_name, cu.mobile, cu.address,
             l.loan_no, l.amount as loan_amount, l.emi_amount,
             u.name as collected_by_name, ce.name as center_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE col.id = ? AND col.customer_id = ?
    `, [req.params.collectionId, customer.id]);

    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    return res.json(receipt);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/next-due', authenticate, requireCustomer, async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id FROM customers WHERE id = ?', [req.user!.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const today = new Date().toISOString().split('T')[0];
    const nextDue = await query<any>(`
      SELECT ls.*, l.loan_no, l.penalty_per_day,
             DATEDIFF(?, ls.due_date) as days_overdue
      FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id
      WHERE l.customer_id = ? AND ls.status IN ('pending','partial','overdue') AND l.status = 'active'
      ORDER BY ls.due_date ASC
      LIMIT 5
    `, [today, customer.id]);

    return res.json(nextDue);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
