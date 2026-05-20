import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const params: any[] = [];
    let where = 'WHERE ce.is_active = 1';

    if (search) {
      where += ' AND (ce.name LIKE ? OR ce.area LIKE ? OR ce.location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (req.user!.role === 'staff') {
      where += ' AND ce.staff_id = ?';
      params.push(req.user!.id);
    }

    const centers = await query<any>(`
      SELECT ce.*, u.name as staff_name,
             COUNT(DISTINCT cu.id) as customer_count,
             COUNT(DISTINCT g.id) as group_count
      FROM centers ce
      LEFT JOIN users u ON ce.staff_id = u.id
      LEFT JOIN customers cu ON cu.center_id = ce.id AND cu.is_active = 1
      LEFT JOIN \`groups\` g ON g.center_id = ce.id AND g.is_active = 1
      ${where}
      GROUP BY ce.id
      ORDER BY ce.name
    `, params);
    return res.json(centers);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const center = await queryOne<any>(`
      SELECT ce.*, u.name as staff_name
      FROM centers ce
      LEFT JOIN users u ON ce.staff_id = u.id
      WHERE ce.id = ?
    `, [req.params.id]);
    if (!center) return res.status(404).json({ error: 'Center not found' });
    return res.json(center);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, meeting_day, meeting_time, area, location, staff_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const id = uuidv4();
    await execute(`
      INSERT INTO centers (id, name, meeting_day, meeting_time, area, location, staff_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, name, meeting_day, meeting_time, area, location, staff_id || null]);

    return res.status(201).json({ id, message: 'Center created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, meeting_day, meeting_time, area, location, staff_id } = req.body;
    await execute(`
      UPDATE centers SET name=?, meeting_day=?, meeting_time=?, area=?, location=?, staff_id=?
      WHERE id=?
    `, [name, meeting_day, meeting_time, area, location, staff_id || null, req.params.id]);
    return res.json({ message: 'Center updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const row = await queryOne<any>('SELECT COUNT(*) as c FROM customers WHERE center_id = ? AND is_active = 1', [req.params.id]);
    if (row?.c > 0) {
      return res.status(400).json({ error: 'Cannot delete center with active customers' });
    }
    await execute('UPDATE centers SET is_active = 0 WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Center deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/groups', authenticate, async (req: Request, res: Response) => {
  try {
    const groups = await query<any>(`
      SELECT g.*, COUNT(cu.id) as customer_count
      FROM \`groups\` g
      LEFT JOIN customers cu ON cu.group_id = g.id AND cu.is_active = 1
      WHERE g.center_id = ? AND g.is_active = 1
      GROUP BY g.id
      ORDER BY g.name
    `, [req.params.id]);
    return res.json(groups);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
