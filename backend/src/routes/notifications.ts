import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await query<any>(`
      SELECT * FROM notifications
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user!.id, limit, offset]);

    const unreadRow = await queryOne<any>(`
      SELECT COUNT(*) as count FROM notifications
      WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
    `, [req.user!.id]);

    return res.json({ notifications, unread: unreadRow?.count || 0 });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await queryOne<any>(`
      SELECT COUNT(*) as count FROM notifications
      WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
    `, [req.user!.id]);
    return res.json({ count: result?.count || 0 });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await execute(`UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      [req.params.id, req.user!.id]);
    return res.json({ message: 'Marked as read' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    await execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL`,
      [req.user!.id]);
    return res.json({ message: 'All marked as read' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/clear-all', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await execute('DELETE FROM notifications WHERE is_read = 1', []);
    return res.json({ message: 'Cleared read notifications' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
