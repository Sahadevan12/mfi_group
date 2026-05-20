import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { execute, query, initDatabase } from './database';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  await initDatabase();

  const adminId = uuidv4();
  await execute(`
    INSERT IGNORE INTO users (id, name, email, password_hash, role, phone)
    VALUES (?, 'Admin SPS', 'admin@spsgroup.com', ?, 'admin', '9876543210')
  `, [adminId, bcrypt.hashSync('admin123', 10)]);

  const staff1Id = uuidv4();
  const staff2Id = uuidv4();
  await execute(`INSERT IGNORE INTO users (id, name, email, password_hash, role, phone) VALUES (?, 'Ravi Kumar', 'ravi@spsgroup.com', ?, 'staff', '9876543211')`, [staff1Id, bcrypt.hashSync('staff123', 10)]);
  await execute(`INSERT IGNORE INTO users (id, name, email, password_hash, role, phone) VALUES (?, 'Priya Sharma', 'priya@spsgroup.com', ?, 'staff', '9876543212')`, [staff2Id, bcrypt.hashSync('staff123', 10)]);

  const center1Id = uuidv4();
  const center2Id = uuidv4();
  await execute(`INSERT IGNORE INTO centers (id, name, meeting_day, meeting_time, area, location, staff_id) VALUES (?, 'Anna Nagar Center', 'Monday', '09:00', 'Anna Nagar', 'Chennai', ?)`, [center1Id, staff1Id]);
  await execute(`INSERT IGNORE INTO centers (id, name, meeting_day, meeting_time, area, location, staff_id) VALUES (?, 'T Nagar Center', 'Tuesday', '10:00', 'T Nagar', 'Chennai', ?)`, [center2Id, staff2Id]);

  const group1Id = uuidv4();
  const group2Id = uuidv4();
  const group3Id = uuidv4();
  await execute('INSERT IGNORE INTO `groups` (id, name, center_id) VALUES (?, \'Mahalakshmi Group\', ?)', [group1Id, center1Id]);
  await execute('INSERT IGNORE INTO `groups` (id, name, center_id) VALUES (?, \'Saraswathi Group\', ?)', [group2Id, center1Id]);
  await execute('INSERT IGNORE INTO `groups` (id, name, center_id) VALUES (?, \'Kavitha Group\', ?)', [group3Id, center2Id]);

  const customers = [
    { name: 'Lakshmi Devi', mobile: '9500012001', center: center1Id, group: group1Id },
    { name: 'Meena Kumari', mobile: '9500012002', center: center1Id, group: group1Id },
    { name: 'Vasantha Bai', mobile: '9500012003', center: center1Id, group: group1Id },
    { name: 'Sundari Ammal', mobile: '9500012004', center: center1Id, group: group2Id },
    { name: 'Chitra Devi', mobile: '9500012005', center: center1Id, group: group2Id },
    { name: 'Kamala Devi', mobile: '9500012006', center: center2Id, group: group3Id },
    { name: 'Radha Krishnan', mobile: '9500012007', center: center2Id, group: group3Id },
    { name: 'Parvathi Ammal', mobile: '9500012008', center: center2Id, group: group3Id },
  ];

  const customerIds: string[] = [];
  for (const c of customers) {
    const id = uuidv4();
    customerIds.push(id);
    await execute(`
      INSERT IGNORE INTO customers (id, name, mobile, center_id, group_id, address, city, state, created_by)
      VALUES (?, ?, ?, ?, ?, 'Chennai', 'Tamil Nadu', 'Tamil Nadu', ?)
    `, [id, c.name, c.mobile, c.center, c.group, adminId]);
  }

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0];

  for (let i = 0; i < Math.min(5, customerIds.length); i++) {
    const loanId = uuidv4();
    const loanNo = `SPS${String(2024).slice(-2)}${String(i + 1).padStart(4, '0')}`;
    const amount = (i + 1) * 10000;
    const rate = 18;
    const months = 12;
    const n = months;
    const periodicRate = rate / 100 / 12;
    const emi = Math.ceil((amount * periodicRate * Math.pow(1 + periodicRate, n)) / (Math.pow(1 + periodicRate, n) - 1));
    const totalPayable = emi * n;
    const totalInterest = totalPayable - amount;

    await execute(`
      INSERT IGNORE INTO loans (id, loan_no, customer_id, amount, interest_rate, interest_type,
        duration, duration_unit, emi_frequency, emi_amount, total_payable, total_interest,
        start_date, end_date, total_installments, total_paid, paid_installments, status, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, 'reducing', ?, 'months', 'monthly', ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())
    `, [loanId, loanNo, customerIds[i], amount, rate, months, emi, totalPayable, totalInterest,
      startDate, new Date(today.getFullYear(), today.getMonth() + 10, 1).toISOString().split('T')[0],
      n, emi * 2, 2, adminId]);

    for (let j = 1; j <= n; j++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() - 2 + j, 1).toISOString().split('T')[0];
      const status = j <= 2 ? 'paid' : j <= 3 ? 'overdue' : 'pending';
      await execute(`
        INSERT IGNORE INTO loan_schedule (id, loan_id, installment_no, due_date, emi_amount, principal, interest, balance, paid_amount, paid_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), loanId, j, dueDate, emi, Math.ceil(amount / n), Math.ceil(totalInterest / n),
        amount - (Math.ceil(amount / n) * j), j <= 2 ? emi : 0,
        j <= 2 ? dueDate : null, status]);

      if (j <= 2) {
        await execute(`
          INSERT IGNORE INTO collections (id, receipt_no, loan_id, customer_id, collected_by,
            amount, payment_date, payment_type, payment_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 'cash')
        `, [uuidv4(), `RCP${Date.now()}${j}${i}`, loanId, customerIds[i], staff1Id, emi, dueDate]);
      }
    }
  }

  console.log('✅ Seed data inserted successfully');
  console.log('');
  console.log('Login credentials:');
  console.log('Admin:  admin@spsgroup.com  / admin123');
  console.log('Staff:  ravi@spsgroup.com   / staff123');
  console.log('Staff:  priya@spsgroup.com  / staff123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
