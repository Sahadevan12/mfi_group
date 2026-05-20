import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { center_id, search } = req.query;
    const params: any[] = [];
    let where = 'WHERE g.is_active = 1';

    if (center_id) { where += ' AND g.center_id = ?'; params.push(center_id); }
    if (search) { where += ' AND (g.name LIKE ? OR g.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    if (req.user!.role === 'staff') {
      where += ' AND g.center_id IN (SELECT id FROM centers WHERE staff_id = ?)';
      params.push(req.user!.id);
    }

    const groups = await query<any>(`
      SELECT g.*, ce.name as center_name, COUNT(cu.id) as customer_count,
             ldr.name as leader_name, ldr.mobile as leader_mobile
      FROM \`groups\` g
      LEFT JOIN centers ce ON g.center_id = ce.id
      LEFT JOIN customers cu ON cu.group_id = g.id AND cu.is_active = 1
      LEFT JOIN customers ldr ON ldr.id = g.leader_id
      ${where}
      GROUP BY g.id ORDER BY g.name
    `, params);
    return res.json(groups);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const group = await queryOne<any>(`
      SELECT g.*, ce.name as center_name,
             ldr.name as leader_name, ldr.mobile as leader_mobile
      FROM \`groups\` g
      LEFT JOIN centers ce ON g.center_id = ce.id
      LEFT JOIN customers ldr ON ldr.id = g.leader_id
      WHERE g.id = ?
    `, [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const customers = await query<any>(`
      SELECT cu.id, cu.name, cu.mobile, cu.photo,
             l.id as loan_id, l.loan_no, l.emi_amount, l.status as loan_status
      FROM customers cu
      LEFT JOIN loans l ON l.customer_id = cu.id AND l.status = 'active'
      WHERE cu.group_id = ? AND cu.is_active = 1
      ORDER BY cu.name
    `, [req.params.id]);

    return res.json({ ...group, customers });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, center_id, description, leader_id } = req.body;
    if (!name || !center_id) return res.status(400).json({ error: 'Name and center required' });

    const id = uuidv4();
    await execute(
      'INSERT INTO `groups` (id, name, center_id, description, leader_id) VALUES (?, ?, ?, ?, ?)',
      [id, name, center_id, description, leader_id || null]
    );
    return res.status(201).json({ id, message: 'Group created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, center_id, description, leader_id } = req.body;
    await execute(
      'UPDATE `groups` SET name=?, center_id=?, description=?, leader_id=? WHERE id=?',
      [name, center_id, description, leader_id || null, req.params.id]
    );
    return res.json({ message: 'Group updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT COUNT(*) as c FROM customers WHERE group_id = ? AND is_active = 1', [req.params.id]);
    if (row?.c > 0) return res.status(400).json({ error: 'Cannot delete group with active customers' });
    await execute('UPDATE `groups` SET is_active = 0 WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Group deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/members', authenticate, async (req: Request, res: Response) => {
  try {
    const members = await query<any>(`
      SELECT cu.id, cu.name, cu.mobile, cu.photo, cu.aadhaar, cu.gender,
             l.id as loan_id, l.loan_no, l.amount, l.emi_amount, l.status as loan_status,
             l.total_paid, l.total_payable
      FROM customers cu
      LEFT JOIN loans l ON l.customer_id = cu.id AND l.status = 'active'
      WHERE cu.group_id = ? AND cu.is_active = 1
      ORDER BY cu.name
    `, [req.params.id]);
    return res.json(members);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members/:customerId', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const customer = await queryOne<any>('SELECT id, group_id FROM customers WHERE id = ? AND is_active = 1', [req.params.customerId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.group_id) return res.status(400).json({ error: 'Customer already belongs to a group. Remove from current group first.' });

    await execute('UPDATE customers SET group_id = ? WHERE id = ?', [req.params.id, req.params.customerId]);
    return res.json({ message: 'Member added to group' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:customerId', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    await execute('UPDATE customers SET group_id = NULL WHERE id = ? AND group_id = ?', [req.params.customerId, req.params.id]);
    return res.json({ message: 'Member removed from group' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/collection', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const customers = await query<any>(`
      SELECT cu.id, cu.name, cu.mobile, cu.photo,
             l.id as loan_id, l.loan_no, l.emi_amount, l.emi_frequency,
             l.total_paid, l.total_payable,
             ls.id as schedule_id, ls.due_date, ls.emi_amount as due_amount,
             ls.paid_amount, ls.status as schedule_status,
             COALESCE(col.amount, 0) as today_paid
      FROM customers cu
      LEFT JOIN loans l ON l.customer_id = cu.id AND l.status = 'active'
      LEFT JOIN loan_schedule ls ON ls.loan_id = l.id AND ls.status IN ('pending', 'partial', 'overdue')
      LEFT JOIN collections col ON col.loan_id = l.id AND col.payment_date = ?
      WHERE cu.group_id = ? AND cu.is_active = 1
      GROUP BY cu.id
      ORDER BY cu.name
    `, [today, req.params.id]);
    return res.json(customers);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, page = '1', limit = '30' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const from = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = end_date || new Date().toISOString().split('T')[0];

    const history = await query<any>(`
      SELECT col.id, col.receipt_no, col.amount, col.penalty_paid, col.payment_date,
             col.payment_mode, col.payment_type,
             cu.id as customer_id, cu.name as customer_name, cu.mobile,
             l.loan_no, u.name as collected_by_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      WHERE cu.group_id = ? AND col.payment_date BETWEEN ? AND ?
      ORDER BY col.payment_date DESC, col.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.params.id, from, to, parseInt(limit as string), offset]);

    const summary = await queryOne<any>(`
      SELECT COUNT(*) as transactions, SUM(col.amount) as total_amount,
             COUNT(DISTINCT col.customer_id) as unique_customers
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE cu.group_id = ? AND col.payment_date BETWEEN ? AND ?
    `, [req.params.id, from, to]);

    return res.json({ history, summary });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
