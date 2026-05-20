import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, category } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (start_date) { where += ' AND expense_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND expense_date <= ?'; params.push(end_date); }
    if (category) { where += ' AND category = ?'; params.push(category); }

    const expenses = await query<any>(`
      SELECT e.*, u.name as created_by_name
      FROM expenses e LEFT JOIN users u ON e.created_by = u.id
      ${where} ORDER BY expense_date DESC
    `, params);

    const total = expenses.reduce((s: number, e: any) => s + e.amount, 0);
    return res.json({ expenses, total });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { category, amount, description, expense_date } = req.body;
    if (!category || !amount || !expense_date) return res.status(400).json({ error: 'Missing fields' });

    const id = uuidv4();
    await execute('INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, category, amount, description, expense_date, req.user!.id]);
    return res.status(201).json({ id, message: 'Expense added' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { category, amount, description, expense_date } = req.body;
    await execute('UPDATE expenses SET category=?, amount=?, description=?, expense_date=? WHERE id=?',
      [category, amount, description, expense_date, req.params.id]);
    return res.json({ message: 'Expense updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await execute('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Expense deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
