import { Router, Request, Response } from 'express';
import { query, queryOne, execute, pool } from '../database';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = Router();

const BACKUP_PATH = process.env.BACKUP_PATH || './backups';
if (!fs.existsSync(BACKUP_PATH)) fs.mkdirSync(BACKUP_PATH, { recursive: true });

const TABLES = [
  'users', 'centers', 'groups', 'customers', 'customer_documents',
  'loans', 'loan_schedule', 'collections', 'expenses', 'notifications',
  'sms_settings', 'sms_logs', 'backup_logs', 'audit_logs'
];

router.get('/list', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const logs = await query<any>(`
      SELECT b.*, u.name as created_by_name
      FROM backup_logs b LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC LIMIT 50
    `);
    return res.json(logs);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const destPath = path.join(BACKUP_PATH, filename);

    // Export all table data as JSON
    const backupData: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
        backupData[table] = rows as any[];
      } catch {
        backupData[table] = [];
      }
    }

    const jsonContent = JSON.stringify({ created_at: new Date().toISOString(), tables: backupData }, null, 2);
    fs.writeFileSync(destPath, jsonContent, 'utf8');

    const stats = fs.statSync(destPath);
    const id = uuidv4();
    await execute(`INSERT INTO backup_logs (id, filename, file_size, created_by) VALUES (?, ?, ?, ?)`,
      [id, filename, stats.size, req.user!.id]);

    return res.json({ id, filename, file_size: stats.size, message: 'Backup created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', authenticate, (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const filename = path.basename(req.params.filename);
  const filePath = path.join(BACKUP_PATH, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
  res.download(filePath, filename);
});

router.delete('/:filename', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const filename = path.basename(req.params.filename);
    const filePath = path.join(BACKUP_PATH, filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    await execute('DELETE FROM backup_logs WHERE filename = ?', [filename]);
    return res.json({ message: 'Backup deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
