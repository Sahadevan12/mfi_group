import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config(); // load .env before pool creation

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sps_mfi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
});

// MySQL2 execute() rejects undefined — convert all undefined to null
function sanitize(params?: any[]): any[] | undefined {
  if (!params) return params;
  return params.map(p => (p === undefined ? null : p));
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.query(sql, sanitize(params));
  return rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const [rows] = await pool.query(sql, sanitize(params));
  const arr = rows as T[];
  return arr.length > 0 ? arr[0] : null;
}

export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, sanitize(params));
  return result as mysql.ResultSetHeader;
}

export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  link?: string
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), userId, title, message, type, link || null]
    );
  } catch {}
}

export async function initDatabase(): Promise<void> {
  // Step 1: create the database if it doesn't exist using a temp connection
  const tempConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await tempConn.execute(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'sps_mfi'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await tempConn.end();

  // Step 2: create all tables
  const conn = await pool.getConnection();

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','staff','customer') NOT NULL,
      phone VARCHAR(255),
      address TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS centers (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      meeting_day VARCHAR(255),
      meeting_time VARCHAR(255),
      area VARCHAR(255),
      location VARCHAR(255),
      staff_id VARCHAR(36),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      center_id VARCHAR(36) NOT NULL,
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (center_id) REFERENCES centers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      name VARCHAR(255) NOT NULL,
      photo VARCHAR(255),
      mobile VARCHAR(255) NOT NULL,
      alt_mobile VARCHAR(255),
      address TEXT,
      city VARCHAR(255),
      state VARCHAR(255),
      pincode VARCHAR(255),
      aadhaar VARCHAR(255),
      pan VARCHAR(255),
      dob VARCHAR(255),
      gender VARCHAR(255),
      nominee_name VARCHAR(255),
      nominee_relation VARCHAR(255),
      nominee_mobile VARCHAR(255),
      guarantor_name VARCHAR(255),
      guarantor_mobile VARCHAR(255),
      guarantor_address TEXT,
      center_id VARCHAR(36),
      group_id VARCHAR(36),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(36),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (center_id) REFERENCES centers(id),
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS customer_documents (
      id VARCHAR(36) PRIMARY KEY,
      customer_id VARCHAR(36) NOT NULL,
      doc_type VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      filepath VARCHAR(255) NOT NULL,
      file_size INT,
      mime_type VARCHAR(255),
      uploaded_by VARCHAR(36),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id VARCHAR(36) PRIMARY KEY,
      loan_no VARCHAR(255) UNIQUE NOT NULL,
      customer_id VARCHAR(36) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      interest_rate DECIMAL(15,2) NOT NULL,
      interest_type ENUM('flat','reducing') NOT NULL,
      duration INT NOT NULL,
      duration_unit VARCHAR(255) NOT NULL DEFAULT 'months',
      emi_frequency ENUM('daily','weekly','monthly') NOT NULL,
      emi_amount DECIMAL(15,2) NOT NULL,
      total_payable DECIMAL(15,2) NOT NULL,
      total_interest DECIMAL(15,2) NOT NULL,
      processing_fee DECIMAL(15,2) DEFAULT 0,
      penalty_per_day DECIMAL(15,2) DEFAULT 0,
      disbursement_date VARCHAR(255),
      start_date VARCHAR(255) NOT NULL,
      end_date VARCHAR(255),
      status ENUM('pending','active','closed','rejected','written_off') DEFAULT 'pending',
      approved_by VARCHAR(36),
      approved_at DATETIME,
      total_paid DECIMAL(15,2) DEFAULT 0,
      total_installments INT NOT NULL,
      paid_installments INT DEFAULT 0,
      notes TEXT,
      created_by VARCHAR(36),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS loan_schedule (
      id VARCHAR(36) PRIMARY KEY,
      loan_id VARCHAR(36) NOT NULL,
      installment_no INT NOT NULL,
      due_date VARCHAR(255) NOT NULL,
      emi_amount DECIMAL(15,2) NOT NULL,
      principal DECIMAL(15,2) NOT NULL,
      interest DECIMAL(15,2) NOT NULL,
      balance DECIMAL(15,2) NOT NULL,
      paid_amount DECIMAL(15,2) DEFAULT 0,
      paid_date VARCHAR(255),
      status ENUM('pending','paid','partial','overdue') DEFAULT 'pending',
      FOREIGN KEY (loan_id) REFERENCES loans(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS collections (
      id VARCHAR(36) PRIMARY KEY,
      receipt_no VARCHAR(255) UNIQUE NOT NULL,
      loan_id VARCHAR(36) NOT NULL,
      customer_id VARCHAR(36) NOT NULL,
      schedule_id VARCHAR(36),
      collected_by VARCHAR(36) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      penalty_paid DECIMAL(15,2) DEFAULT 0,
      payment_date VARCHAR(255) NOT NULL,
      payment_type ENUM('regular','partial','advance','penalty') NOT NULL DEFAULT 'regular',
      payment_mode ENUM('cash','upi','bank_transfer','cheque') DEFAULT 'cash',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loan_id) REFERENCES loans(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (schedule_id) REFERENCES loan_schedule(id),
      FOREIGN KEY (collected_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(36) PRIMARY KEY,
      category VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      expense_date VARCHAR(255) NOT NULL,
      created_by VARCHAR(36),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info','success','warning','error') DEFAULT 'info',
      link VARCHAR(255),
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sms_settings (
      id VARCHAR(36) PRIMARY KEY,
      provider VARCHAR(255) DEFAULT 'msg91',
      api_key VARCHAR(500) DEFAULT '',
      sender_id VARCHAR(255) DEFAULT 'SPSGRP',
      is_active TINYINT(1) DEFAULT 0,
      template_due_reminder VARCHAR(500) DEFAULT 'Dear {name}, your EMI of Rs.{amount} for loan {loan_no} is due on {date}. Please pay on time. -SPS Group',
      template_payment_success VARCHAR(500) DEFAULT 'Dear {name}, payment of Rs.{amount} received for loan {loan_no}. Receipt: {receipt}. -SPS Group',
      template_loan_approved VARCHAR(500) DEFAULT 'Dear {name}, your loan of Rs.{amount} (Loan No: {loan_no}) has been approved. EMI: Rs.{emi}/{freq}. -SPS Group',
      template_overdue VARCHAR(500) DEFAULT 'Dear {name}, your EMI for loan {loan_no} is overdue by {days} days. Amt due: Rs.{amount}. Please contact us. -SPS Group',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id VARCHAR(36) PRIMARY KEY,
      customer_id VARCHAR(36),
      mobile VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(255) NOT NULL,
      status ENUM('pending','sent','failed') DEFAULT 'pending',
      provider_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS backup_logs (
      id VARCHAR(36) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      file_size INT,
      created_by VARCHAR(36),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      action VARCHAR(255) NOT NULL,
      table_name VARCHAR(255),
      record_id VARCHAR(255),
      details TEXT,
      ip_address VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Indexes (IF NOT EXISTS is not standard for indexes in MySQL; use CREATE INDEX ... IF NOT EXISTS via version check or just try/catch)
  const indexes = [
    'CREATE INDEX idx_loans_customer ON loans(customer_id)',
    'CREATE INDEX idx_loans_status ON loans(status)',
    'CREATE INDEX idx_schedule_loan ON loan_schedule(loan_id)',
    'CREATE INDEX idx_schedule_due ON loan_schedule(due_date)',
    'CREATE INDEX idx_collections_loan ON collections(loan_id)',
    'CREATE INDEX idx_collections_date ON collections(payment_date)',
    'CREATE INDEX idx_customers_center ON customers(center_id)',
    'CREATE INDEX idx_customers_group ON customers(group_id)',
    'CREATE INDEX idx_notifications_user ON notifications(user_id, is_read)',
    'CREATE INDEX idx_docs_customer ON customer_documents(customer_id)',
  ];

  for (const idx of indexes) {
    try { await conn.execute(idx); } catch {}
  }

  await conn.execute(`INSERT IGNORE INTO sms_settings (id) VALUES ('default')`);

  // Auto-configure OTP from environment variable (set APITXT_OTP_KEY in Hostinger env panel)
  if (process.env.APITXT_OTP_KEY) {
    await conn.execute(
      `UPDATE sms_settings SET otp_api_key = ?, otp_provider = 'apitxt' WHERE id = 'default'`,
      [process.env.APITXT_OTP_KEY]
    );
    console.log('✅ apitxt OTP key configured from environment');
  }

  // Add new columns to existing tables (safe: ignore error if column already exists)
  const migrations = [
    `ALTER TABLE loans ADD COLUMN disbursement_date VARCHAR(255) AFTER penalty_per_day`,
    `ALTER TABLE \`groups\` ADD COLUMN leader_id VARCHAR(36) AFTER description`,
    `ALTER TABLE sms_settings ADD COLUMN otp_api_key VARCHAR(500) DEFAULT NULL AFTER api_key`,
    `ALTER TABLE sms_settings ADD COLUMN otp_provider VARCHAR(50) DEFAULT 'twofactor' AFTER otp_api_key`,
    `ALTER TABLE loans ADD COLUMN loan_type VARCHAR(50) DEFAULT 'JLG' AFTER notes`,
    `ALTER TABLE loans ADD COLUMN loan_reason VARCHAR(255) DEFAULT NULL AFTER loan_type`,
  ];
  for (const m of migrations) {
    try { await conn.execute(m); } catch {}
  }

  conn.release();
  console.log('✅ MySQL Database initialized');
}

export default pool;
