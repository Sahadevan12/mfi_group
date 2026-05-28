import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, withTransaction } from '../database';
import { authenticate, requireRole } from '../middleware/auth';
import { calculateLoan, generateLoanNumber } from '../utils/loanCalculator';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, customer_id, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (status) { where += ' AND l.status = ?'; params.push(status); }
    if (customer_id) { where += ' AND l.customer_id = ?'; params.push(customer_id); }
    if (search) { where += ' AND (l.loan_no LIKE ? OR cu.name LIKE ? OR cu.mobile LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM loans l JOIN customers cu ON l.customer_id = cu.id ${where}`, params);
    const total = countRow?.c || 0;

    const loans = await query<any>(`
      SELECT l.*, cu.name as customer_name, cu.mobile,
             ce.name as center_name, g.name as group_name,
             u.name as approved_by_name
      FROM loans l
      JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      LEFT JOIN users u ON l.approved_by = u.id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit as string), offset]);

    return res.json({ loans, total, page: parseInt(page as string) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/calculate', authenticate, (req: Request, res: Response) => {
  const { amount, interestRate, interestType, duration, durationUnit, emiFrequency, startDate } = req.query;
  if (!amount || !interestRate || !interestType || !duration || !emiFrequency || !startDate) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const result = calculateLoan({
    amount: parseFloat(amount as string),
    interestRate: parseFloat(interestRate as string),
    interestType: interestType as 'flat' | 'reducing',
    duration: parseInt(duration as string),
    durationUnit: (durationUnit || 'months') as any,
    emiFrequency: emiFrequency as any,
    startDate: startDate as string,
  });

  return res.json(result);
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const loan = await queryOne<any>(`
      SELECT l.*, cu.name as customer_name, cu.mobile, cu.address,
             ce.name as center_name, g.name as group_name,
             u.name as approved_by_name
      FROM loans l
      JOIN customers cu ON l.customer_id = cu.id
      LEFT JOIN centers ce ON cu.center_id = ce.id
      LEFT JOIN \`groups\` g ON cu.group_id = g.id
      LEFT JOIN users u ON l.approved_by = u.id
      WHERE l.id = ?
    `, [req.params.id]);

    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const schedule = await query<any>(`
      SELECT ls.*, c.amount as collected_amount, c.payment_date as collected_date
      FROM loan_schedule ls
      LEFT JOIN collections c ON c.schedule_id = ls.id
      WHERE ls.loan_id = ?
      ORDER BY ls.installment_no
    `, [req.params.id]);

    const collections = await query<any>(`
      SELECT col.*, u.name as collected_by_name
      FROM collections col
      JOIN users u ON col.collected_by = u.id
      WHERE col.loan_id = ?
      ORDER BY col.payment_date DESC
    `, [req.params.id]);

    return res.json({ ...loan, schedule, collections });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    const {
      customer_id, amount, interest_rate, interest_type, duration, duration_unit,
      emi_frequency, disbursement_date, start_date, processing_fee, penalty_per_day,
      notes, loan_type, loan_reason
    } = req.body;

    if (!customer_id || !amount || !interest_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calc = calculateLoan({
      amount: parseFloat(amount),
      interestRate: parseFloat(interest_rate),
      interestType: interest_type,
      duration: parseInt(duration),
      durationUnit: duration_unit || 'months',
      emiFrequency: emi_frequency,
      startDate: start_date,
    });

    const loanId = uuidv4();
    const loanNo = generateLoanNumber();

    await withTransaction(async (conn) => {
      await conn.execute(`
        INSERT INTO loans (id, loan_no, customer_id, amount, interest_rate, interest_type,
          duration, duration_unit, emi_frequency, emi_amount, total_payable, total_interest,
          processing_fee, penalty_per_day, disbursement_date, start_date, end_date,
          total_installments, notes, loan_type, loan_reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        loanId, loanNo, customer_id, amount, interest_rate, interest_type,
        duration, duration_unit || 'months', emi_frequency, calc.emiAmount,
        calc.totalPayable, calc.totalInterest,
        processing_fee || 0, penalty_per_day || 0,
        disbursement_date || start_date,
        start_date, calc.endDate,
        calc.totalInstallments, notes || null,
        loan_type || 'JLG', loan_reason || null, req.user!.id
      ]);

      for (const entry of calc.schedule) {
        await conn.execute(`
          INSERT INTO loan_schedule (id, loan_id, installment_no, due_date, emi_amount, principal, interest, balance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [uuidv4(), loanId, entry.installmentNo, entry.dueDate, entry.emiAmount, entry.principal, entry.interest, entry.balance]);
      }
    });

    return res.status(201).json({ id: loanId, loan_no: loanNo, ...calc, message: 'Loan created' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/approve', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const loan = await queryOne<any>('SELECT * FROM loans WHERE id = ?', [req.params.id]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status !== 'pending') return res.status(400).json({ error: 'Loan is not pending' });

    await execute(`
      UPDATE loans SET status = 'active', approved_by = ?, approved_at = NOW() WHERE id = ?
    `, [req.user!.id, req.params.id]);

    return res.json({ message: 'Loan approved' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reject', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await execute("UPDATE loans SET status = 'rejected' WHERE id = ?", [req.params.id]);
    return res.json({ message: 'Loan rejected' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id/close', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await execute("UPDATE loans SET status = 'closed' WHERE id = ?", [req.params.id]);
    return res.json({ message: 'Loan closed' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
