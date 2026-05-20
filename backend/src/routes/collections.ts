import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, withTransaction } from '../database';
import { authenticate } from '../middleware/auth';
import { generateReceiptNumber } from '../utils/loanCalculator';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { date, loan_id, customer_id, collected_by, group_id, center_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (date)        { where += ' AND col.payment_date = ?'; params.push(date); }
    if (loan_id)     { where += ' AND col.loan_id = ?';      params.push(loan_id); }
    if (customer_id) { where += ' AND col.customer_id = ?';  params.push(customer_id); }
    if (collected_by){ where += ' AND col.collected_by = ?'; params.push(collected_by); }
    if (group_id)    { where += ' AND cu.group_id = ?';      params.push(group_id); }
    if (center_id)   { where += ' AND cu.center_id = ?';     params.push(center_id); }

    if (req.user?.role === 'staff') {
      const staffCenter = await queryOne<any>('SELECT id FROM centers WHERE staff_id = ?', [req.user.id]);
      if (staffCenter) { where += ' AND cu.center_id = ?'; params.push(staffCenter.id); }
      else { where += ' AND 1=0'; }
    }

    // Count query must JOIN customers so cu.* references in WHERE work
    const countRow = await queryOne<any>(`
      SELECT COUNT(*) as c
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      ${where}
    `, params);
    const total = countRow?.c || 0;

    const collections = await query<any>(`
      SELECT col.*, cu.name as customer_name, cu.mobile,
             l.loan_no, u.name as collected_by_name,
             ce.name as center_name, g.name as group_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      ${where}
      ORDER BY col.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit as string), offset]);

    return res.json({ collections, total });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { center_id, group_id } = req.query;
    const params: any[] = [today, today];
    let centerFilter = '';

    if (req.user?.role === 'staff') {
      const staffCenter = await queryOne<any>('SELECT id FROM centers WHERE staff_id = ?', [req.user.id]);
      if (staffCenter) { centerFilter += ' AND cu.center_id = ?'; params.push(staffCenter.id); }
      else { centerFilter += ' AND 1=0'; }
    } else {
      if (center_id) { centerFilter += ' AND cu.center_id = ?'; params.push(center_id); }
      if (group_id) { centerFilter += ' AND cu.group_id = ?'; params.push(group_id); }
    }

    const pending = await query<any>(`
      SELECT ls.id, ls.loan_id, ls.installment_no, ls.due_date, ls.emi_amount,
             ls.paid_amount, ls.status,
             cu.id as customer_id, cu.name as customer_name, cu.mobile,
             l.loan_no, l.emi_frequency, l.penalty_per_day,
             ce.name as center_name, g.name as group_name,
             DATEDIFF(?, ls.due_date) as days_overdue
      FROM loan_schedule ls
      JOIN loans l ON ls.loan_id = l.id AND l.status = 'active'
      JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      WHERE ls.status IN ('pending', 'partial', 'overdue') AND ls.due_date <= ?
      ${centerFilter}
      ORDER BY ls.due_date ASC
    `, params);

    return res.json(pending);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Group billing sheet — all active-loan customers in a group with their next pending EMI
router.get('/group-sheet', authenticate, async (req: Request, res: Response) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const today = new Date().toISOString().split('T')[0];

    // For staff: verify the group belongs to their center
    if (req.user?.role === 'staff') {
      const staffCenter = await queryOne<any>('SELECT id FROM centers WHERE staff_id = ?', [req.user.id]);
      if (staffCenter) {
        const grp = await queryOne<any>('SELECT id FROM `groups` WHERE id = ? AND center_id = ?', [group_id, staffCenter.id]);
        if (!grp) return res.status(403).json({ error: 'Access denied to this group' });
      }
    }

    const rows = await query<any>(`
      SELECT
        cu.id          AS customer_id,
        cu.name        AS customer_name,
        cu.mobile,
        l.id           AS loan_id,
        l.loan_no,
        l.emi_amount,
        l.emi_frequency,
        l.penalty_per_day,
        l.total_paid,
        l.total_payable,
        ls.id          AS schedule_id,
        ls.installment_no,
        ls.due_date,
        ls.emi_amount  AS due_amount,
        ls.paid_amount,
        ls.status      AS schedule_status,
        DATEDIFF(?, ls.due_date) AS days_overdue
      FROM customers cu
      JOIN loans l ON l.customer_id = cu.id AND l.status = 'active'
      JOIN loan_schedule ls ON ls.id = (
        SELECT id FROM loan_schedule
        WHERE loan_id = l.id
          AND status IN ('pending','partial','overdue')
        ORDER BY installment_no ASC
        LIMIT 1
      )
      WHERE cu.group_id = ?
      ORDER BY cu.name ASC
    `, [today, group_id]);

    return res.json(rows);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      loan_id, customer_id, schedule_id, amount, penalty_paid,
      payment_date, payment_type, payment_mode, notes
    } = req.body;

    if (!loan_id || !customer_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const loan = await queryOne<any>("SELECT * FROM loans WHERE id = ? AND status = 'active'", [loan_id]);
    if (!loan) return res.status(400).json({ error: 'Loan not found or not active' });

    const receiptNo = generateReceiptNumber();
    const collectionId = uuidv4();
    const totalAmount = parseFloat(amount) + (parseFloat(penalty_paid) || 0);

    await withTransaction(async (conn) => {
      await conn.execute(`
        INSERT INTO collections (id, receipt_no, loan_id, customer_id, schedule_id, collected_by,
          amount, penalty_paid, payment_date, payment_type, payment_mode, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [collectionId, receiptNo, loan_id, customer_id, schedule_id || null,
        req.user!.id, amount, penalty_paid || 0, payment_date,
        payment_type || 'regular', payment_mode || 'cash', notes]);

      await conn.execute(`
        UPDATE loans SET total_paid = total_paid + ?,
          paid_installments = CASE WHEN ? >= emi_amount THEN paid_installments + 1 ELSE paid_installments END
        WHERE id = ?
      `, [totalAmount, parseFloat(amount), loan_id]);

      if (schedule_id) {
        const [schedRows] = await conn.execute('SELECT * FROM loan_schedule WHERE id = ?', [schedule_id]) as any;
        const schedule = (schedRows as any[])[0];
        if (schedule) {
          const newPaid = (schedule.paid_amount || 0) + parseFloat(amount);
          const newStatus = newPaid >= schedule.emi_amount ? 'paid' : 'partial';
          await conn.execute('UPDATE loan_schedule SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?',
            [newPaid, payment_date, newStatus, schedule_id]);
        }
      }

      const [loanRows] = await conn.execute('SELECT * FROM loans WHERE id = ?', [loan_id]) as any;
      const updatedLoan = (loanRows as any[])[0];
      if (updatedLoan && updatedLoan.total_paid >= updatedLoan.total_payable) {
        await conn.execute("UPDATE loans SET status = 'closed' WHERE id = ?", [loan_id]);
        await conn.execute("UPDATE loan_schedule SET status = 'paid' WHERE loan_id = ? AND status != 'paid'", [loan_id]);
      }
    });

    return res.status(201).json({
      id: collectionId,
      receipt_no: receiptNo,
      message: 'Collection recorded',
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const { collections } = req.body;
    if (!Array.isArray(collections) || collections.length === 0) {
      return res.status(400).json({ error: 'Collections array required' });
    }

    const results: any[] = [];

    await withTransaction(async (conn) => {
      for (const col of collections) {
        if (!col.loan_id || !col.customer_id || !col.amount) continue;

        const [loanCheck] = await conn.execute("SELECT * FROM loans WHERE id = ? AND status = 'active'", [col.loan_id]) as any;
        const loanArr = loanCheck as any[];
        if (!loanArr || loanArr.length === 0) continue;

        const receiptNo = generateReceiptNumber();
        const collectionId = uuidv4();

        await conn.execute(`
          INSERT INTO collections (id, receipt_no, loan_id, customer_id, schedule_id, collected_by,
            amount, penalty_paid, payment_date, payment_type, payment_mode, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [collectionId, receiptNo, col.loan_id, col.customer_id, col.schedule_id || null,
          req.user!.id, col.amount, col.penalty_paid || 0,
          col.payment_date || new Date().toISOString().split('T')[0],
          'regular', col.payment_mode || 'cash', col.notes]);

        await conn.execute('UPDATE loans SET total_paid = total_paid + ? WHERE id = ?', [col.amount, col.loan_id]);

        if (col.schedule_id) {
          const [schedRows] = await conn.execute('SELECT * FROM loan_schedule WHERE id = ?', [col.schedule_id]) as any;
          const schedule = (schedRows as any[])[0];
          if (schedule) {
            const newPaid = (schedule.paid_amount || 0) + parseFloat(col.amount);
            const newStatus = newPaid >= schedule.emi_amount ? 'paid' : 'partial';
            await conn.execute('UPDATE loan_schedule SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?',
              [newPaid, col.payment_date, newStatus, col.schedule_id]);
          }
        }

        results.push({ customer_id: col.customer_id, receipt_no: receiptNo });
      }
    });

    return res.status(201).json({ results, message: `${results.length} collections recorded` });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/receipt/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const collection = await queryOne<any>(`
      SELECT col.*, cu.name as customer_name, cu.mobile, cu.address,
             l.loan_no, l.amount as loan_amount,
             u.name as collected_by_name,
             ce.name as center_name
      FROM collections col
      JOIN customers cu ON col.customer_id = cu.id
      JOIN loans l ON col.loan_id = l.id
      JOIN users u ON col.collected_by = u.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      WHERE col.id = ?
    `, [req.params.id]);

    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    return res.json(collection);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
