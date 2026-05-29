import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database';
import { authenticate } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = Router();

const sseClients: Set<Response> = new Set();

export async function broadcastDashboardUpdate() {
  try {
    const data = await getDashboardStats();
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
      try { client.write(message); } catch {}
    });
  } catch {}
}

async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const totalCustomers = (await queryOne<any>('SELECT COUNT(*) as c FROM customers WHERE is_active = 1'))?.c || 0;
  const activeLoans = (await queryOne<any>("SELECT COUNT(*) as c FROM loans WHERE status = 'active'"))?.c || 0;
  const pendingLoans = (await queryOne<any>("SELECT COUNT(*) as c FROM loans WHERE status = 'pending'"))?.c || 0;
  const totalCollection = (await queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM collections WHERE payment_date = ?", [today]))?.s || 0;
  const monthCollection = (await queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM collections WHERE DATE_FORMAT(payment_date, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')", [today]))?.s || 0;
  const totalCollectionAll = (await queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM collections"))?.s || 0;
  const overdueLoans = (await queryOne<any>(`SELECT COUNT(DISTINCT loan_id) as c FROM loan_schedule WHERE status = 'overdue' OR (due_date < ? AND status = 'pending')`, [today]))?.c || 0;
  const pendingAmount = (await queryOne<any>(`SELECT COALESCE(SUM(emi_amount - paid_amount), 0) as s FROM loan_schedule WHERE status IN ('pending', 'partial', 'overdue') AND due_date <= ?`, [today]))?.s || 0;
  const totalCenters = (await queryOne<any>('SELECT COUNT(*) as c FROM centers WHERE is_active = 1'))?.c || 0;
  const totalStaff = (await queryOne<any>("SELECT COUNT(*) as c FROM users WHERE role = 'staff' AND is_active = 1"))?.c || 0;

  const totalPrincipal = (await queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM loans WHERE status = 'active'"))?.s || 0;

  const totalOutstanding = (await queryOne<any>(`
    SELECT COALESCE(SUM(l.total_payable) - SUM(COALESCE(col.collected, 0)), 0) as s
    FROM loans l
    LEFT JOIN (SELECT loan_id, SUM(amount) as collected FROM collections GROUP BY loan_id) col
      ON col.loan_id = l.id
    WHERE l.status = 'active'
  `))?.s || 0;

  const totalInterest = (await queryOne<any>("SELECT COALESCE(SUM(total_interest), 0) as s FROM loans WHERE status IN ('active', 'closed')"))?.s || 0;
  const totalDisbursed = (await queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM loans WHERE status IN ('active', 'closed', 'written_off')"))?.s || 0;

  return {
    totalCustomers, activeLoans, pendingLoans, totalCollection, monthCollection,
    totalCollectionAll, overdueLoans, pendingAmount, totalCenters, totalStaff,
    totalPrincipal, totalOutstanding, totalInterest, totalDisbursed
  };
}

router.get('/live', (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).end();

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'secret';
    jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial data
  getDashboardStats().then(data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }).catch(() => {});

  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch {}
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    return res.json(await getDashboardStats());
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/recent-collections', authenticate, async (req: Request, res: Response) => {
  try {
    const collections = await query<any>(`
      SELECT c.id, c.receipt_no, c.amount, c.payment_date, c.payment_mode,
             cu.name as customer_name, cu.mobile,
             u.name as collected_by_name
      FROM collections c
      JOIN customers cu ON c.customer_id = cu.id
      JOIN users u ON c.collected_by = u.id
      ORDER BY c.created_at DESC LIMIT 10
    `);
    return res.json(collections);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/center-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await query<any>(`
      SELECT ce.id, ce.name, ce.area,
             COUNT(DISTINCT cu.id) as customer_count,
             COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
             COALESCE(SUM(col.amount), 0) as total_collected
      FROM centers ce
      LEFT JOIN customers cu ON cu.center_id = ce.id AND cu.is_active = 1
      LEFT JOIN loans l ON l.customer_id = cu.id
      LEFT JOIN collections col ON col.customer_id = cu.id
      WHERE ce.is_active = 1
      GROUP BY ce.id
    `);
    return res.json(stats);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/monthly-trend', authenticate, async (req: Request, res: Response) => {
  try {
    const trend = await query<any>(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
             SUM(amount) as total,
             COUNT(*) as transactions
      FROM collections
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month
    `);
    return res.json(trend);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Staff-specific dashboard stats — only their own data
router.get('/staff-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const staffId = req.user!.id;
    const today = new Date().toISOString().split('T')[0];
    const monthStr = today.substring(0, 7);

    const todayCollection = (await queryOne<any>(
      'SELECT COALESCE(SUM(amount), 0) as s FROM collections WHERE collected_by = ? AND payment_date = ?',
      [staffId, today]
    ))?.s || 0;

    const monthCollection = (await queryOne<any>(
      "SELECT COALESCE(SUM(amount), 0) as s FROM collections WHERE collected_by = ? AND DATE_FORMAT(payment_date, '%Y-%m') = ?",
      [staffId, monthStr]
    ))?.s || 0;

    const totalCollection = (await queryOne<any>(
      'SELECT COALESCE(SUM(amount), 0) as s FROM collections WHERE collected_by = ?',
      [staffId]
    ))?.s || 0;

    const todayTransactions = (await queryOne<any>(
      'SELECT COUNT(*) as c FROM collections WHERE collected_by = ? AND payment_date = ?',
      [staffId, today]
    ))?.c || 0;

    const myCenters = await query<any>(`
      SELECT ce.id, ce.name, ce.area,
             COUNT(DISTINCT cu.id) as customers,
             COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_loans,
             COALESCE((
               SELECT SUM(c2.amount) FROM collections c2
               JOIN customers cu2 ON c2.customer_id = cu2.id
               WHERE cu2.center_id = ce.id
             ), 0) as total_collected
      FROM centers ce
      LEFT JOIN customers cu ON cu.center_id = ce.id AND cu.is_active = 1
      LEFT JOIN loans l ON l.customer_id = cu.id
      WHERE ce.staff_id = ? AND ce.is_active = 1
      GROUP BY ce.id
    `, [staffId]);

    const myCustomers = myCenters.reduce((s: number, c: any) => s + Number(c.customers), 0);
    const myActiveLoans = myCenters.reduce((s: number, c: any) => s + Number(c.active_loans), 0);

    const myPending = await queryOne<any>(`
      SELECT COUNT(DISTINCT ls.loan_id) as cnt,
             COALESCE(SUM(ls.emi_amount - ls.paid_amount), 0) as amount
      FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id AND l.status = 'active'
      JOIN customers cu ON l.customer_id = cu.id
      JOIN centers ce ON cu.center_id = ce.id
      WHERE ce.staff_id = ? AND ls.status IN ('pending','overdue') AND ls.due_date <= ?
    `, [staffId, today]);

    const recentCollections = await query<any>(`
      SELECT col.id, col.receipt_no, col.amount, col.payment_date, col.payment_mode,
             cu.name as customer_name, cu.mobile,
             ce.name as center_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE col.collected_by = ?
      ORDER BY col.created_at DESC LIMIT 15
    `, [staffId]);

    const monthlyTrend = await query<any>(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
             SUM(amount) as total, COUNT(*) as transactions
      FROM collections
      WHERE collected_by = ? AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `, [staffId]);

    return res.json({
      todayCollection, monthCollection, totalCollection, todayTransactions,
      myCustomers, myActiveLoans, centerCount: myCenters.length,
      myPendingAmount: myPending?.amount || 0,
      myPendingCount: myPending?.cnt || 0,
      myCenters, recentCollections, monthlyTrend,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/agent-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const stats = await query<any>(`
      SELECT u.id, u.name, u.phone,
             COUNT(DISTINCT col.id) as total_collections,
             COALESCE(SUM(col.amount), 0) as total_amount,
             COUNT(DISTINCT CASE WHEN col.payment_date = ? THEN col.id END) as today_collections,
             COALESCE(SUM(CASE WHEN col.payment_date >= ? THEN col.amount ELSE 0 END), 0) as month_amount
      FROM users u
      LEFT JOIN collections col ON col.collected_by = u.id
      WHERE u.role = 'staff' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY total_amount DESC
    `, [today, monthStart]);
    return res.json(stats);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
