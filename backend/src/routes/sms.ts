import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../database';
import { authenticate } from '../middleware/auth';
import { sendSMS } from '../services/smsService';

const router = Router();

router.get('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id = ?', ['default']);
    return res.json(settings || {});
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const {
      provider, api_key, sender_id, is_active,
      template_due_reminder, template_payment_success,
      template_loan_approved, template_overdue,
    } = req.body;

    await execute(`
      INSERT INTO sms_settings (id, provider, api_key, sender_id, is_active,
        template_due_reminder, template_payment_success, template_loan_approved, template_overdue, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        provider = VALUES(provider),
        api_key = VALUES(api_key),
        sender_id = VALUES(sender_id),
        is_active = VALUES(is_active),
        template_due_reminder = VALUES(template_due_reminder),
        template_payment_success = VALUES(template_payment_success),
        template_loan_approved = VALUES(template_loan_approved),
        template_overdue = VALUES(template_overdue),
        updated_at = NOW()
    `, [provider, api_key, sender_id, is_active ? 1 : 0,
      template_due_reminder, template_payment_success, template_loan_approved, template_overdue]);

    return res.json({ message: 'Settings saved' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/test', authenticate, (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { mobile, message } = req.body;
  if (!mobile || !message) return res.status(400).json({ error: 'mobile and message required' });

  sendSMS(null, mobile, message, 'test').then(success => {
    return res.json({ success, message: success ? 'SMS sent successfully' : 'SMS failed' });
  }).catch(() => res.status(500).json({ error: 'Failed to send' }));
});

router.get('/logs', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let sql = 'SELECT l.*, c.name as customer_name FROM sms_logs l LEFT JOIN customers c ON l.customer_id = c.id';
    const params: any[] = [];
    if (status) { sql += ' WHERE l.status = ?'; params.push(status); }
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await query<any>(sql, params);

    const countSql = `SELECT COUNT(*) as count FROM sms_logs${status ? ' WHERE status=?' : ''}`;
    const totalRow = await queryOne<any>(countSql, status ? [status] : []);
    return res.json({ logs, total: totalRow?.count || 0 });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/send-due-reminders', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const days = parseInt(req.body.days as string) || 3;
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    const schedules = await query<{ id: string }>(`
      SELECT ls.id FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE ls.status IN ('pending','partial') AND ls.due_date BETWEEN ? AND ?
      AND cu.mobile IS NOT NULL AND l.status = 'active'
    `, [today, future]);

    const { sendDueReminderSMS } = await import('../services/smsService');
    schedules.forEach(s => sendDueReminderSMS(s.id));

    return res.json({ message: `Queued ${schedules.length} reminders` });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/send-overdue-alerts', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const today = new Date().toISOString().split('T')[0];

    const loans = await query<{ id: string }>(`
      SELECT DISTINCT l.id FROM loans l
      JOIN loan_schedule ls ON ls.loan_id = l.id
      JOIN customers cu ON l.customer_id = cu.id
      WHERE ls.status IN ('pending','partial','overdue') AND ls.due_date < ?
      AND l.status = 'active' AND cu.mobile IS NOT NULL
    `, [today]);

    const { sendOverdueSMS } = await import('../services/smsService');
    loans.forEach(l => sendOverdueSMS(l.id));

    return res.json({ message: `Queued ${loans.length} overdue alerts` });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
