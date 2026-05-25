import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/daily-collection', authenticate, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];
    const isStaff = req.user!.role === 'staff';
    const sf = isStaff ? ' AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)' : '';
    const sp = isStaff ? [req.user!.id] : [];

    const summary = await queryOne<any>(`
      SELECT COUNT(*) as total_transactions,
             SUM(col.amount) as total_amount,
             SUM(col.penalty_paid) as total_penalty,
             COUNT(DISTINCT col.customer_id) as customers_paid,
             COUNT(DISTINCT col.loan_id) as loans_paid
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE col.payment_date = ? ${sf}
    `, [targetDate, ...sp]);

    const byAgent = await query<any>(`
      SELECT u.name as agent_name, COUNT(*) as transactions,
             SUM(col.amount) as amount
      FROM collections col
      JOIN users u ON col.collected_by = u.id
      JOIN customers cu ON col.customer_id = cu.id
      WHERE col.payment_date = ? ${sf}
      GROUP BY col.collected_by, u.name
    `, [targetDate, ...sp]);

    const details = await query<any>(`
      SELECT col.receipt_no, col.amount, col.payment_mode, col.payment_type,
             cu.name as customer_name, cu.mobile,
             l.loan_no, ce.name as center_name, g.name as group_name,
             u.name as collected_by_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE col.payment_date = ? ${sf}
      ORDER BY col.created_at
    `, [targetDate, ...sp]);

    return res.json({ date: targetDate, summary, byAgent, details });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/weekly-collection', authenticate, async (req: Request, res: Response) => {
  try {
    const { week_start } = req.query;
    let from: string;
    if (week_start) {
      from = week_start as string;
    } else {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      from = d.toISOString().split('T')[0];
    }
    const to = new Date(new Date(from).getTime() + 6 * 86400000).toISOString().split('T')[0];
    const isStaff = req.user!.role === 'staff';
    const sf = isStaff ? ' AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)' : '';
    const sp = isStaff ? [req.user!.id] : [];

    const summary = await queryOne<any>(`
      SELECT COUNT(*) as total_transactions,
             SUM(col.amount) as total_amount,
             SUM(col.penalty_paid) as total_penalty,
             COUNT(DISTINCT col.customer_id) as customers_paid
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE col.payment_date BETWEEN ? AND ? ${sf}
    `, [from, to, ...sp]);

    const daily = await query<any>(`
      SELECT col.payment_date, SUM(col.amount) as amount, COUNT(*) as transactions
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE col.payment_date BETWEEN ? AND ? ${sf}
      GROUP BY col.payment_date ORDER BY col.payment_date
    `, [from, to, ...sp]);

    const byCenter = await query<any>(`
      SELECT ce.name as center_name, SUM(col.amount) as amount, COUNT(*) as transactions
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE col.payment_date BETWEEN ? AND ? ${sf}
      GROUP BY ce.id, ce.name ORDER BY amount DESC
    `, [from, to, ...sp]);

    const byGroup = await query<any>(`
      SELECT g.name as group_name, ce.name as center_name,
             SUM(col.amount) as amount, COUNT(*) as transactions
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE col.payment_date BETWEEN ? AND ? ${sf}
      GROUP BY g.id, g.name, ce.name ORDER BY amount DESC
    `, [from, to, ...sp]);

    const details = await query<any>(`
      SELECT col.receipt_no, col.amount, col.payment_date, col.payment_mode, col.payment_type,
             cu.name as customer_name, l.loan_no,
             ce.name as center_name, g.name as group_name,
             u.name as collected_by_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE col.payment_date BETWEEN ? AND ? ${sf}
      ORDER BY col.payment_date, col.created_at
    `, [from, to, ...sp]);

    return res.json({ from, to, summary, daily, byCenter, byGroup, details });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/monthly-collection', authenticate, async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const monthStr = `${y}-${m}`;
    const isStaff = req.user!.role === 'staff';
    const sf = isStaff ? ' AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)' : '';
    const sp = isStaff ? [req.user!.id] : [];

    const summary = await queryOne<any>(`
      SELECT SUM(col.amount) as total_amount, COUNT(*) as transactions,
             COUNT(DISTINCT col.customer_id) as unique_customers
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE DATE_FORMAT(col.payment_date, '%Y-%m') = ? ${sf}
    `, [monthStr, ...sp]);

    const daily = await query<any>(`
      SELECT col.payment_date, SUM(col.amount) as amount, COUNT(*) as transactions
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      WHERE DATE_FORMAT(col.payment_date, '%Y-%m') = ? ${sf}
      GROUP BY col.payment_date ORDER BY col.payment_date
    `, [monthStr, ...sp]);

    const byCenter = await query<any>(`
      SELECT ce.name as center_name, SUM(col.amount) as amount, COUNT(*) as transactions
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE DATE_FORMAT(col.payment_date, '%Y-%m') = ? ${sf}
      GROUP BY ce.id, ce.name ORDER BY amount DESC
    `, [monthStr, ...sp]);

    return res.json({ month: monthStr, summary, daily, byCenter });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/group-wise', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, center_id, group_id } = req.query;
    const from = (start_date as string) || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const to = (end_date as string) || new Date().toISOString().split('T')[0];
    const params: any[] = [to, to, from, to, from, to];
    let centerFilter = '';
    if (center_id) { centerFilter += ' AND g.center_id = ?'; params.push(center_id); }
    if (group_id)  { centerFilter += ' AND g.id = ?';        params.push(group_id); }
    if (req.user!.role === 'staff') {
      centerFilter += ' AND g.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)';
      params.push(req.user!.id);
    }

    const data = await query<any>(`
      SELECT g.id, g.name as group_name, ce.name as center_name,
             COUNT(DISTINCT cu.id) as members,
             COUNT(DISTINCT CASE WHEN l.status='active' THEN l.id END) as active_loans,
             COALESCE(SUM(col.amount), 0) as collected,
             COUNT(DISTINCT CASE WHEN ls.status IN ('pending','overdue') AND ls.due_date <= ? THEN ls.id END) as pending_installments,
             COALESCE(SUM(CASE WHEN ls.status IN ('pending','overdue') AND ls.due_date <= ? THEN ls.emi_amount - ls.paid_amount ELSE 0 END), 0) as pending_amount
      FROM \`groups\` g
      LEFT JOIN centers ce ON g.center_id = ce.id
      LEFT JOIN customers cu ON cu.group_id = g.id AND cu.is_active = 1
      LEFT JOIN loans l ON l.customer_id = cu.id
      LEFT JOIN collections col ON col.customer_id = cu.id AND col.payment_date BETWEEN ? AND ?
      LEFT JOIN loan_schedule ls ON ls.loan_id = l.id
      WHERE g.is_active = 1 ${centerFilter}
      GROUP BY g.id, g.name, ce.name ORDER BY collected DESC
    `, params);

    return res.json(data);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/pending-dues', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { center_id, group_id } = req.query;
    const params: any[] = [today, today];
    let filter = '';
    if (center_id) { filter += ' AND cu.center_id = ?'; params.push(center_id); }
    if (group_id)  { filter += ' AND cu.group_id = ?';  params.push(group_id); }
    if (req.user!.role === 'staff') {
      filter += ' AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)';
      params.push(req.user!.id);
    }

    const dues = await query<any>(`
      SELECT cu.id as customer_id, cu.name as customer_name, cu.mobile,
             l.id as loan_id, l.loan_no, l.emi_frequency,
             COUNT(ls.id) as pending_installments,
             SUM(ls.emi_amount - ls.paid_amount) as pending_amount,
             MIN(ls.due_date) as earliest_due,
             MAX(DATEDIFF(?, ls.due_date)) as max_days_overdue,
             ce.name as center_name, g.name as group_name
      FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id AND l.status = 'active'
      JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE ls.status IN ('pending', 'partial', 'overdue') AND ls.due_date <= ?
      ${filter}
      GROUP BY l.id
      ORDER BY max_days_overdue DESC
    `, params);

    const totalPending = dues.reduce((sum: number, d: any) => sum + d.pending_amount, 0);
    return res.json({ dues, totalPending, count: dues.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/defaulters', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const isStaff = req.user!.role === 'staff';
    const sf = isStaff ? ' AND cu.center_id IN (SELECT id FROM centers WHERE staff_id = ? AND is_active = 1)' : '';
    const sp = isStaff ? [req.user!.id] : [];

    const defaulters = await query<any>(`
      SELECT cu.id, cu.name, cu.mobile, cu.address,
             l.id as loan_id, l.loan_no, l.amount,
             l.total_paid, l.total_payable - l.total_paid as outstanding,
             MIN(ls.due_date) as overdue_since,
             DATEDIFF(?, MIN(ls.due_date)) as days_overdue,
             COUNT(ls.id) as overdue_installments,
             ce.name as center_name, g.name as group_name
      FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id AND l.status = 'active'
      JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE ls.status IN ('pending', 'overdue') AND ls.due_date < DATE_SUB(?, INTERVAL 30 DAY) ${sf}
      GROUP BY l.id
      ORDER BY days_overdue DESC
    `, [today, today, ...sp]);

    return res.json(defaulters);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/loan-ledger/:loanId', authenticate, async (req: Request, res: Response) => {
  try {
    const loan = await queryOne<any>(`
      SELECT l.*, cu.name as customer_name, cu.mobile, cu.address,
             ce.name as center_name
      FROM loans l JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE l.id = ?
    `, [req.params.loanId]);

    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const schedule = await query<any>('SELECT * FROM loan_schedule WHERE loan_id = ? ORDER BY installment_no', [req.params.loanId]);
    const collections = await query<any>(`
      SELECT col.*, u.name as collected_by_name
      FROM collections col JOIN users u ON col.collected_by = u.id
      WHERE col.loan_id = ? ORDER BY col.payment_date
    `, [req.params.loanId]);

    return res.json({ loan, schedule, collections });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/center-wise', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, center_id } = req.query;
    const from = (start_date as string) || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const to = (end_date as string) || new Date().toISOString().split('T')[0];

    const params: any[] = [to, from, to];
    let centerFilter = '';
    if (center_id) { centerFilter += ' AND ce.id = ?'; params.push(center_id); }
    if (req.user!.role === 'staff') {
      centerFilter += ' AND ce.staff_id = ?'; params.push(req.user!.id);
    }

    const data = await query<any>(`
      SELECT ce.id, ce.name, ce.area,
             COUNT(DISTINCT cu.id) as customers,
             COUNT(DISTINCT l.id) as active_loans,
             COALESCE(SUM(col.amount), 0) as collected,
             COUNT(DISTINCT CASE WHEN ls.status IN ('pending','overdue') AND ls.due_date <= ? THEN ls.id END) as pending_installments
      FROM centers ce
      LEFT JOIN customers cu ON cu.center_id = ce.id AND cu.is_active = 1
      LEFT JOIN loans l ON l.customer_id = cu.id AND l.status = 'active'
      LEFT JOIN collections col ON col.customer_id = cu.id
        AND col.payment_date BETWEEN ? AND ?
      LEFT JOIN loan_schedule ls ON ls.loan_id = l.id
      WHERE ce.is_active = 1 ${centerFilter}
      GROUP BY ce.id ORDER BY collected DESC
    `, params);

    return res.json(data);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/agent-wise', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const from = (start_date as string) || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const to = (end_date as string) || new Date().toISOString().split('T')[0];

    const agents = await query<any>(`
      SELECT u.id, u.name, u.phone, u.email,
             COUNT(DISTINCT col.id) as total_collections,
             COALESCE(SUM(col.amount), 0) as total_amount,
             COUNT(DISTINCT col.customer_id) as unique_customers,
             COUNT(DISTINCT col.payment_date) as working_days
      FROM users u
      LEFT JOIN collections col ON col.collected_by = u.id AND col.payment_date BETWEEN ? AND ?
      WHERE u.role IN ('admin', 'staff') AND u.is_active = 1
      GROUP BY u.id
      ORDER BY total_amount DESC
    `, [from, to]);

    const dailyTrend = await query<any>(`
      SELECT u.id as agent_id, u.name as agent_name,
             col.payment_date, SUM(col.amount) as amount
      FROM collections col
      JOIN users u ON col.collected_by = u.id
      WHERE col.payment_date BETWEEN ? AND ?
      GROUP BY u.id, col.payment_date
      ORDER BY col.payment_date
    `, [from, to]);

    return res.json({ agents, dailyTrend, from, to });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/profit-loss', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const from = (start_date as string) || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const to = (end_date as string) || new Date().toISOString().split('T')[0];

    const collections = await queryOne<any>(`
      SELECT SUM(col.amount) as total_collected,
             SUM(col.penalty_paid) as total_penalty
      FROM collections col
      WHERE col.payment_date BETWEEN ? AND ?
    `, [from, to]);

    const principalRepaid = await queryOne<any>(`
      SELECT COALESCE(SUM(ls.principal * (col.amount / ls.emi_amount)), 0) as principal
      FROM collections col
      JOIN loan_schedule ls ON col.schedule_id = ls.id
      WHERE col.payment_date BETWEEN ? AND ?
    `, [from, to]);

    const processingFees = await queryOne<any>(`
      SELECT COALESCE(SUM(l.processing_fee), 0) as fees
      FROM loans l
      WHERE l.status != 'pending' AND l.created_at BETWEEN ? AND ?
    `, [from + ' 00:00:00', to + ' 23:59:59']);

    const expenseData = await query<any>(`
      SELECT category, SUM(amount) as amount
      FROM expenses WHERE expense_date BETWEEN ? AND ?
      GROUP BY category ORDER BY amount DESC
    `, [from, to]);

    const totalExpenses = expenseData.reduce((s: number, e: any) => s + e.amount, 0);
    const totalInterest = (collections?.total_collected || 0) - (principalRepaid?.principal || 0);
    const grossIncome = totalInterest + (collections?.total_penalty || 0) + (processingFees?.fees || 0);
    const netProfit = grossIncome - totalExpenses;

    const monthly = await query<any>(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
             SUM(amount) as collections
      FROM collections WHERE payment_date BETWEEN ? AND ?
      GROUP BY month ORDER BY month
    `, [from, to]);

    return res.json({
      from, to,
      income: {
        total_collected: collections?.total_collected || 0,
        interest_income: totalInterest,
        penalty_income: collections?.total_penalty || 0,
        processing_fees: processingFees?.fees || 0,
        gross_income: grossIncome,
      },
      expenses: { breakdown: expenseData, total: totalExpenses },
      net_profit: netProfit,
      monthly,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/cashbook', authenticate, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const from = (start_date as string) || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const to = (end_date as string) || new Date().toISOString().split('T')[0];

    const income = await query<any>(`
      SELECT payment_date as date, 'Collection' as type, SUM(amount) as amount
      FROM collections WHERE payment_date BETWEEN ? AND ?
      GROUP BY payment_date ORDER BY payment_date
    `, [from, to]);

    const expenses = await query<any>(`
      SELECT expense_date as date, category as type, SUM(amount) as amount
      FROM expenses WHERE expense_date BETWEEN ? AND ?
      GROUP BY expense_date, category ORDER BY expense_date
    `, [from, to]);

    const totalIncome = income.reduce((s: number, r: any) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s: number, r: any) => s + r.amount, 0);

    return res.json({ income, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
