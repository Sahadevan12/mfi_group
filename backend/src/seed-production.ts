/**
 * Production seed — creates ONLY the admin user.
 * No dummy data, no sample centers/groups/customers/loans.
 *
 * Usage (run once after deploying to server):
 *   npm run seed:prod
 *
 * Set in .env before running:
 *   ADMIN_NAME=Your Name
 *   ADMIN_EMAIL=yourname@example.com
 *   ADMIN_PASSWORD=YourStrongPassword123
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { execute, initDatabase } from './database';
import dotenv from 'dotenv';

dotenv.config();

async function seedProduction() {
  await initDatabase();

  const name     = process.env.ADMIN_NAME     || 'Admin';
  const email    = process.env.ADMIN_EMAIL    || 'admin@spsgroup.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';
  const phone    = process.env.ADMIN_PHONE    || '';

  // Check if admin already exists
  const { query } = await import('./database');
  const existing = await query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
  if (existing.length > 0) {
    console.log('⚠️  Admin user already exists. Skipping.');
    console.log('   If you want to reset, delete the user from DB first.');
    process.exit(0);
  }

  const hash = bcrypt.hashSync(password, 12);
  await execute(
    `INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, 'admin', ?)`,
    [uuidv4(), name, email, hash, phone]
  );

  console.log('');
  console.log('✅  Production admin user created!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Name  : ${name}`);
  console.log(`  Email : ${email}`);
  console.log(`  Password: ${password}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ⚠️  Change your password after first login!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seedProduction().catch(err => { console.error(err); process.exit(1); });
