import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

import { initDatabase, execute, query } from './database';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import centerRoutes from './routes/centers';
import groupRoutes from './routes/groups';
import customerRoutes from './routes/customers';
import loanRoutes from './routes/loans';
import collectionRoutes from './routes/collections';
import staffRoutes from './routes/staff';
import reportRoutes from './routes/reports';
import expenseRoutes from './routes/expenses';
import uploadRoutes from './routes/upload';
import notificationRoutes from './routes/notifications';
import smsRoutes from './routes/sms';
import backupRoutes from './routes/backup';
import portalRoutes from './routes/portal';
import verifyRoutes from './routes/verify';

const app = express();
const PORT = process.env.PORT || 5000;

// Async startup
(async () => {
  try {
    // Init DB
    await initDatabase();

    // Ensure directories exist
    [
      process.env.UPLOAD_PATH || './uploads',
      process.env.BACKUP_PATH || './backups',
    ].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Middleware
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')));

    const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
    app.use('/api', limiter);

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/centers', centerRoutes);
    app.use('/api/groups', groupRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/loans', loanRoutes);
    app.use('/api/collections', collectionRoutes);
    app.use('/api/staff', staffRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/expenses', expenseRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/sms', smsRoutes);
    app.use('/api/backup', backupRoutes);
    app.use('/api/portal', portalRoutes);
    app.use('/api/verify', verifyRoutes);

    app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

    // Scheduled tasks
    // Every day at 8am: send due reminders for next 3 days
    cron.schedule('0 8 * * *', async () => {
      try {
        const { sendDueReminderSMS } = await import('./services/smsService');
        const today = new Date().toISOString().split('T')[0];
        const future = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const schedules = await query<{ id: string }>(`
          SELECT ls.id FROM loan_schedule ls
          JOIN loans l ON ls.loan_id = l.id
          JOIN customers cu ON l.customer_id = cu.id
          WHERE ls.status IN ('pending','partial') AND ls.due_date BETWEEN ? AND ?
          AND cu.mobile IS NOT NULL AND l.status = 'active'
        `, [today, future]);
        schedules.forEach(s => sendDueReminderSMS(s.id));
        console.log(`[CRON] Due reminder SMS queued for ${schedules.length} schedules`);
      } catch (err) { console.error('[CRON] Due reminder error:', err); }
    });

    // Every day at 9am: auto-backup (JSON export for MySQL)
    cron.schedule('0 9 * * *', async () => {
      try {
        const { pool } = await import('./database');
        const { v4: uuidv4 } = await import('uuid');
        const fsModule = await import('fs');
        const pathModule = await import('path');
        const BACKUP_PATH = process.env.BACKUP_PATH || './backups';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto_backup_${timestamp}.json`;
        const destPath = pathModule.default.join(BACKUP_PATH, filename);

        const TABLES = [
          'users', 'centers', 'groups', 'customers', 'customer_documents',
          'loans', 'loan_schedule', 'collections', 'expenses', 'notifications',
          'sms_settings', 'sms_logs', 'backup_logs', 'audit_logs'
        ];
        const backupData: Record<string, any[]> = {};
        for (const table of TABLES) {
          try {
            const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
            backupData[table] = rows as any[];
          } catch { backupData[table] = []; }
        }

        fsModule.default.writeFileSync(destPath, JSON.stringify({ created_at: new Date().toISOString(), tables: backupData }, null, 2), 'utf8');
        const stats = fsModule.default.statSync(destPath);
        await execute('INSERT INTO backup_logs (id, filename, file_size) VALUES (?, ?, ?)', [uuidv4(), filename, stats.size]);

        // Keep only last 7 auto-backups
        const autoBackups = await query<{ filename: string }>("SELECT filename FROM backup_logs WHERE filename LIKE 'auto_backup_%' ORDER BY created_at DESC");
        if (autoBackups.length > 7) {
          for (const b of autoBackups.slice(7)) {
            try {
              const fp = pathModule.default.join(BACKUP_PATH, b.filename);
              if (fsModule.default.existsSync(fp)) fsModule.default.unlinkSync(fp);
              await execute('DELETE FROM backup_logs WHERE filename = ?', [b.filename]);
            } catch {}
          }
        }
        console.log(`[CRON] Auto-backup created: ${filename}`);
      } catch (err) { console.error('[CRON] Auto-backup error:', err); }
    });

    // Update overdue loan schedule statuses every day at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const result = await execute(`
          UPDATE loan_schedule SET status = 'overdue'
          WHERE status IN ('pending', 'partial') AND due_date < ?
        `, [today]);
        console.log(`[CRON] Marked ${result.affectedRows} installments as overdue`);
      } catch (err) { console.error('[CRON] Overdue update error:', err); }
    });

    app.listen(PORT, () => {
      console.log(`\n🚀 SPS Group MFI Server running on http://localhost:${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api`);
      console.log(`\nRun "npm run seed" to initialize sample data\n`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

export default app;
