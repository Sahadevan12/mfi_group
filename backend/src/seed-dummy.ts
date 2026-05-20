import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { execute, initDatabase } from './database';
import dotenv from 'dotenv';

dotenv.config();

const TODAY = '2026-05-18';

function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function calcFlat(P: number, annualRate: number, months: number) {
  const totalInterest = Math.ceil(P * annualRate / 100 * months / 12);
  const emi = Math.ceil((P + totalInterest) / months);
  const totalPayable = emi * months;
  return { emi, totalPayable, totalInterest: totalPayable - P };
}

function calcReducing(P: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12;
  const emi = Math.ceil((P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
  const totalPayable = emi * months;
  const totalInterest = totalPayable - P;
  return { emi, totalPayable, totalInterest };
}

let loanSeq = 1;
function nextLoanNo() { return `SPS26${String(loanSeq++).padStart(4, '0')}`; }

let rcpSeq = 1;
function nextReceipt() { return `RCP2026${String(rcpSeq++).padStart(5, '0')}`; }

async function seedDummy() {
  await initDatabase();

  // Clear all data
  await execute('DELETE FROM backup_logs', []);
  await execute('DELETE FROM audit_logs', []);
  await execute('DELETE FROM sms_logs', []);
  await execute('DELETE FROM notifications', []);
  await execute('DELETE FROM collections', []);
  await execute('DELETE FROM loan_schedule', []);
  await execute('DELETE FROM loans', []);
  await execute('DELETE FROM customer_documents', []);
  await execute('DELETE FROM customers', []);
  await execute('DELETE FROM expenses', []);
  await execute('DELETE FROM `groups`', []);
  await execute('DELETE FROM centers', []);
  await execute('DELETE FROM users', []);

  console.log('🗑️  Cleared existing data');

  // Users
  const adminId = uuidv4();
  await execute(`INSERT INTO users (id, name, email, password_hash, role, phone)
    VALUES (?, 'Admin SPS', 'admin@spsgroup.com', ?, 'admin', '9876540000')`,
    [adminId, bcrypt.hashSync('admin123', 10)]);

  const staff = [
    { id: uuidv4(), name: 'Ravi Kumar',    email: 'ravi@spsgroup.com',    phone: '9876541001' },
    { id: uuidv4(), name: 'Priya Sharma',  email: 'priya@spsgroup.com',   phone: '9876541002' },
    { id: uuidv4(), name: 'Suresh Babu',   email: 'suresh@spsgroup.com',  phone: '9876541003' },
  ];
  for (const s of staff) {
    await execute(`INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, 'staff', ?)`,
      [s.id, s.name, s.email, bcrypt.hashSync('staff123', 10), s.phone]);
  }

  // Centers
  const centers = [
    { id: uuidv4(), name: 'Anna Nagar Center', day: 'Monday',    time: '09:00', area: 'Anna Nagar', loc: 'Chennai', staffId: staff[0].id },
    { id: uuidv4(), name: 'T Nagar Center',    day: 'Tuesday',   time: '10:00', area: 'T Nagar',    loc: 'Chennai', staffId: staff[1].id },
    { id: uuidv4(), name: 'Velachery Center',  day: 'Wednesday', time: '09:30', area: 'Velachery',  loc: 'Chennai', staffId: staff[2].id },
  ];
  for (const c of centers) {
    await execute(`INSERT INTO centers (id, name, meeting_day, meeting_time, area, location, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.day, c.time, c.area, c.loc, c.staffId]);
  }

  // Groups (3 per center = 9)
  const gNames = [
    ['Mahalakshmi Group', 'Saraswathi Group', 'Kavitha Group'],
    ['Ambiga Group',      'Meenakshi Group',  'Durgai Group'],
    ['Lakshmi Group',     'Parvathi Group',   'Bhuvaneswari Group'],
  ];
  const allGroups: { id: string; centerId: string; staffId: string }[] = [];
  for (let ci = 0; ci < 3; ci++) {
    for (const gn of gNames[ci]) {
      const gId = uuidv4();
      await execute('INSERT INTO `groups` (id, name, center_id) VALUES (?, ?, ?)', [gId, gn, centers[ci].id]);
      allGroups.push({ id: gId, centerId: centers[ci].id, staffId: centers[ci].staffId });
    }
  }

  // Customers (3 per group = 27)
  const cNames = [
    ['Lakshmi Devi',       'Meena Kumari',       'Vasantha Bai'],
    ['Sundari Ammal',      'Chitra Devi',         'Kamala Devi'],
    ['Radha Krishnan',     'Parvathi Ammal',      'Selvi Ramasamy'],
    ['Gomathi Sundaram',   'Annamalai Devi',      'Kasthuri Palanivel'],
    ['Muthu Selvi',        'Ponni Krishnan',      'Saroja Devi'],
    ['Thilaga Bai',        'Uma Maheswari',       'Valli Rajendran'],
    ['Yamuna Devi',        'Anbu Selvi',          'Bhuvaneswari Murugan'],
    ['Chellammal Kannan',  'Dharani Ramasamy',    'Ezhilarasi Perumal'],
    ['Fathima Begum',      'Gowri Shankar',       'Hemalatha Arumugam'],
  ];

  const dobs = ['1980-03-12', '1985-07-22', '1990-01-08', '1978-11-30', '1982-05-14',
                '1988-09-25', '1975-04-17', '1993-12-03', '1987-06-29'];
  const addresses = [
    '12, Anna Nagar East', '45, Anna Nagar West', '78, Anna Nagar 2nd St',
    '23, T Nagar Main Rd', '67, Pondy Bazaar', '11, Usman Road',
    '34, Velachery Main Rd', '89, Taramani Link Rd', '56, Medavakkam Rd',
  ];

  const customers: { id: string; centerId: string; groupId: string; staffId: string }[] = [];
  let mobile = 9500012001;

  for (let gi = 0; gi < 9; gi++) {
    const g = allGroups[gi];
    for (let ni = 0; ni < 3; ni++) {
      const cId = uuidv4();
      await execute(`
        INSERT INTO customers (id, name, mobile, center_id, group_id, address, city, state,
          gender, dob, nominee_name, nominee_relation, nominee_mobile, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'Chennai', 'Tamil Nadu', 'Female', ?, 'Husband Name', 'Husband', ?, ?)
      `, [cId, cNames[gi][ni], String(mobile++), g.centerId, g.id,
             addresses[gi], dobs[gi],
             `9600${String(mobile).slice(-6)}`, adminId]);
      customers.push({ id: cId, centerId: g.centerId, groupId: g.id, staffId: g.staffId });
    }
  }

  // Loans, Schedules & Collections
  type LoanCfg = {
    custIdx: number;
    amount: number;
    rate: number;
    months: number;
    type: 'flat' | 'reducing';
    startDate: string;
    status: 'active' | 'closed' | 'pending';
    paidCount: number;
    penalty: number;
  };

  const loans: LoanCfg[] = [
    { custIdx: 0,  amount: 25000,  rate: 24, months: 12, type: 'flat',     startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 5  },
    { custIdx: 1,  amount: 30000,  rate: 22, months: 12, type: 'reducing', startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 5  },
    { custIdx: 2,  amount: 20000,  rate: 24, months: 12, type: 'flat',     startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 5  },
    { custIdx: 3,  amount: 50000,  rate: 20, months: 18, type: 'reducing', startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 10 },
    { custIdx: 4,  amount: 15000,  rate: 24, months: 12, type: 'flat',     startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 3  },
    { custIdx: 5,  amount: 40000,  rate: 22, months: 18, type: 'reducing', startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 8  },
    { custIdx: 6,  amount: 35000,  rate: 24, months: 12, type: 'flat',     startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 7  },
    { custIdx: 7,  amount: 60000,  rate: 20, months: 24, type: 'reducing', startDate: '2025-11-01', status: 'active', paidCount: 5, penalty: 10 },
    { custIdx: 8,  amount: 25000,  rate: 22, months: 12, type: 'flat',     startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 5  },
    { custIdx: 9,  amount: 45000,  rate: 20, months: 18, type: 'reducing', startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 8  },
    { custIdx: 10, amount: 20000,  rate: 24, months: 12, type: 'flat',     startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 5  },
    { custIdx: 11, amount: 75000,  rate: 18, months: 24, type: 'reducing', startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 15 },
    { custIdx: 12, amount: 30000,  rate: 22, months: 12, type: 'flat',     startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 6  },
    { custIdx: 13, amount: 50000,  rate: 20, months: 18, type: 'reducing', startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 10 },
    { custIdx: 14, amount: 15000,  rate: 24, months: 12, type: 'flat',     startDate: '2026-01-01', status: 'active', paidCount: 3, penalty: 3  },
    { custIdx: 15, amount: 40000,  rate: 22, months: 12, type: 'reducing', startDate: '2026-03-01', status: 'active', paidCount: 1, penalty: 8  },
    { custIdx: 16, amount: 25000,  rate: 24, months: 12, type: 'flat',     startDate: '2026-03-01', status: 'active', paidCount: 1, penalty: 5  },
    { custIdx: 17, amount: 60000,  rate: 20, months: 18, type: 'reducing', startDate: '2026-03-01', status: 'active', paidCount: 1, penalty: 10 },
    { custIdx: 18, amount: 20000,  rate: 24, months: 12, type: 'flat',     startDate: '2026-03-01', status: 'active', paidCount: 1, penalty: 5  },
    { custIdx: 19, amount: 100000, rate: 18, months: 24, type: 'reducing', startDate: '2026-03-01', status: 'active', paidCount: 1, penalty: 20 },
    { custIdx: 20, amount: 15000,  rate: 24, months: 12, type: 'flat',     startDate: '2025-04-01', status: 'closed', paidCount: 12, penalty: 0 },
    { custIdx: 21, amount: 20000,  rate: 22, months: 12, type: 'reducing', startDate: '2025-04-01', status: 'closed', paidCount: 12, penalty: 0 },
    { custIdx: 22, amount: 25000,  rate: 20, months: 12, type: 'flat',     startDate: '2025-04-01', status: 'closed', paidCount: 12, penalty: 0 },
    { custIdx: 23, amount: 50000,  rate: 20, months: 18, type: 'reducing', startDate: TODAY, status: 'pending', paidCount: 0, penalty: 0 },
    { custIdx: 24, amount: 30000,  rate: 22, months: 12, type: 'flat',     startDate: TODAY, status: 'pending', paidCount: 0, penalty: 0 },
    { custIdx: 25, amount: 75000,  rate: 18, months: 24, type: 'reducing', startDate: TODAY, status: 'pending', paidCount: 0, penalty: 0 },
    { custIdx: 26, amount: 20000,  rate: 24, months: 12, type: 'flat',     startDate: TODAY, status: 'pending', paidCount: 0, penalty: 0 },
  ];

  const payModes = ['cash', 'cash', 'cash', 'upi', 'cash', 'bank_transfer', 'cash', 'upi'];
  let totalCollections = 0;

  for (const cfg of loans) {
    const cust = customers[cfg.custIdx];
    const loanId = uuidv4();
    const loanNo = nextLoanNo();
    const calc = cfg.type === 'flat'
      ? calcFlat(cfg.amount, cfg.rate, cfg.months)
      : calcReducing(cfg.amount, cfg.rate, cfg.months);
    const { emi, totalPayable, totalInterest } = calc;
    const endDate = addMonths(cfg.startDate, cfg.months);
    const isApproved = cfg.status !== 'pending';
    const totalPaid = cfg.status === 'closed' ? totalPayable : cfg.paidCount * emi;

    await execute(`
      INSERT INTO loans (id, loan_no, customer_id, amount, interest_rate, interest_type,
        duration, duration_unit, emi_frequency, emi_amount, total_payable, total_interest,
        processing_fee, penalty_per_day, start_date, end_date, status,
        total_installments, total_paid, paid_installments, approved_by, approved_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'months', 'monthly', ?, ?, ?, 200, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      loanId, loanNo, cust.id, cfg.amount, cfg.rate, cfg.type,
      cfg.months, emi, totalPayable, totalInterest, cfg.penalty,
      cfg.startDate, endDate, cfg.status, cfg.months,
      totalPaid, cfg.paidCount,
      isApproved ? adminId : null,
      isApproved ? `${cfg.startDate} 10:00:00` : null,
      adminId,
    ]);

    if (cfg.status === 'pending') continue;

    let balance = cfg.amount;
    const r = cfg.rate / 100 / 12;

    for (let i = 1; i <= cfg.months; i++) {
      const dueDate = addMonths(cfg.startDate, i);
      let interest: number, principal: number;

      if (cfg.type === 'reducing') {
        interest = Math.ceil(balance * r);
        principal = Math.max(0, emi - interest);
        balance = Math.max(0, balance - principal);
      } else {
        interest = Math.ceil(cfg.amount * r);
        principal = Math.max(0, emi - interest);
        balance = Math.max(0, balance - principal);
      }

      const isPaid    = i <= cfg.paidCount;
      const isOverdue = !isPaid && dueDate <= TODAY;
      const schedStatus = isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending';
      const schedId = uuidv4();

      await execute(`
        INSERT INTO loan_schedule (id, loan_id, installment_no, due_date, emi_amount,
          principal, interest, balance, paid_amount, paid_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        schedId, loanId, i, dueDate, emi,
        principal, interest, Math.max(0, balance),
        isPaid ? emi : 0,
        isPaid ? dueDate : null,
        schedStatus,
      ]);

      if (isPaid) {
        const mode = payModes[(i + cfg.custIdx) % payModes.length] as any;
        await execute(`
          INSERT INTO collections (id, receipt_no, loan_id, customer_id, schedule_id,
            collected_by, amount, penalty_paid, payment_date, payment_type, payment_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'regular', ?)
        `, [uuidv4(), nextReceipt(), loanId, cust.id, schedId,
               cust.staffId, emi, dueDate, mode]);
        totalCollections++;
      }
    }
  }

  // Expenses (last 6 months)
  const months6 = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
  for (const mon of months6) {
    await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Office Rent',   15000, 'Monthly office rent - Anna Nagar HQ',  ?, ?)`, [uuidv4(), `${mon}-05`, adminId]);
    await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Staff Salary',  85000, 'Monthly salaries - 3 field staff',      ?, ?)`, [uuidv4(), `${mon}-01`, adminId]);
    await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Utilities',      3500, 'Electricity + internet bills',          ?, ?)`, [uuidv4(), `${mon}-10`, adminId]);
    await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Stationery',     1200, 'Passbooks, receipts and printing',      ?, ?)`, [uuidv4(), `${mon}-08`, adminId]);
    await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Travel',         2800, 'Field visit travel reimbursements',     ?, ?)`, [uuidv4(), `${mon}-20`, adminId]);
  }
  await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Maintenance', 8000, 'Office furniture & equipment purchase', '2026-01-20', ?)`, [uuidv4(), adminId]);
  await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Travel',      4500, 'Q1 field audit trip - all centers',     '2026-03-15', ?)`, [uuidv4(), adminId]);
  await execute(`INSERT INTO expenses (id, category, amount, description, expense_date, created_by) VALUES (?, 'Stationery',  2100, 'Annual passbook printing batch',        '2026-04-02', ?)`, [uuidv4(), adminId]);

  // Notifications
  await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, '4 Pending Loan Applications', 'Review and approve 4 new loan applications.', 'warning', 0)`, [uuidv4(), adminId]);
  await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, 'Overdue Loans Alert', '20 loan installments are overdue. Immediate follow-up required.', 'error', 0)`, [uuidv4(), adminId]);
  await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, 'May 2026 Collection Update', 'Month-to-date collection: ₹1.2L (65% of target). 17 days remaining.', 'info', 0)`, [uuidv4(), adminId]);
  await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, '3 Loans Closed', 'Three customers have completed their loan repayments this month!', 'success', 1)`, [uuidv4(), adminId]);

  for (const s of staff) {
    await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, 'Pending Collections Today', 'You have overdue collections in your area. Please visit customers.', 'warning', 0)`, [uuidv4(), s.id]);
    await execute(`INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, 'New Customer Added', 'A new customer has been registered in your center.', 'info', 1)`, [uuidv4(), s.id]);
  }

  console.log('');
  console.log('✅  Dummy data inserted successfully!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LOGIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin  :  admin@spsgroup.com   /  admin123');
  console.log('  Staff 1:  ravi@spsgroup.com    /  staff123');
  console.log('  Staff 2:  priya@spsgroup.com   /  staff123');
  console.log('  Staff 3:  suresh@spsgroup.com  /  staff123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DATA SUMMARY');
  console.log('  Centers  : 3   (Anna Nagar / T Nagar / Velachery)');
  console.log('  Staff    : 3   (1 per center)');
  console.log('  Groups   : 9   (3 per center)');
  console.log('  Customers: 27  (3 per group)');
  console.log('  Loans    : 27  (20 active · 3 closed · 4 pending)');
  console.log(`  Collections: ${totalCollections}  (payments recorded)`);
  console.log('  Expenses : 33  (6 months of monthly expenses)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seedDummy().catch(err => { console.error(err); process.exit(1); });
