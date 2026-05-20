import { query, queryOne, execute } from '../database';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface SMSTemplate {
  name: string;
  mobile: string;
  amount?: string;
  loan_no?: string;
  date?: string;
  receipt?: string;
  emi?: string;
  freq?: string;
  days?: string;
}

function fillTemplate(template: string, vars: SMSTemplate): string {
  let msg = template;
  Object.entries(vars).forEach(([k, v]) => {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '');
  });
  return msg;
}

async function sendViaMSG91(apiKey: string, senderId: string, mobile: string, message: string): Promise<{ success: boolean; response: string }> {
  try {
    const res = await axios.get('https://api.msg91.com/api/sendhttp.php', {
      params: {
        authkey: apiKey,
        mobiles: mobile.replace(/\D/g, ''),
        message,
        sender: senderId,
        route: '4',
        country: '91',
      },
      timeout: 10000,
    });
    return { success: true, response: String(res.data) };
  } catch (err: any) {
    return { success: false, response: err.message };
  }
}

async function sendViaTwilio(apiKey: string, senderId: string, mobile: string, message: string): Promise<{ success: boolean; response: string }> {
  try {
    const [accountSid, authToken] = apiKey.split(':');
    const res = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ To: mobile, From: senderId, Body: message }),
      { auth: { username: accountSid, password: authToken }, timeout: 10000 }
    );
    return { success: true, response: res.data.sid };
  } catch (err: any) {
    return { success: false, response: err.message };
  }
}

async function sendViaFast2SMS(apiKey: string, mobile: string, message: string): Promise<{ success: boolean; response: string }> {
  try {
    const res = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        sender_id: 'FSTSMS',       // default sender for quick route
        message,
        language: 'english',
        route: 'q',                 // quick route — no DLT registration needed
        numbers: mobile.replace(/\D/g, '').slice(-10),
      },
      timeout: 10000,
    });
    // Fast2SMS returns { return: true, status_code: "200", message: ["SMS sent successfully"] }
    const success = res.data?.return === true;
    return { success, response: JSON.stringify(res.data) };
  } catch (err: any) {
    return { success: false, response: err.response?.data ? JSON.stringify(err.response.data) : err.message };
  }
}

export async function sendSMS(customerId: string | null, mobile: string, message: string, type: string): Promise<boolean> {
  const logId = uuidv4();

  await execute(
    `INSERT INTO sms_logs (id, customer_id, mobile, message, type, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [logId, customerId, mobile, message, type]
  );

  const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id = ?', ['default']);
  if (!settings?.is_active || !settings?.api_key) {
    console.log(`[SMS LOG] ${type} → ${mobile}: ${message}`);
    await execute(`UPDATE sms_logs SET status='sent', provider_response='[SIMULATED - no provider configured]' WHERE id=?`, [logId]);
    return true;
  }

  let result = { success: false, response: 'Unknown provider' };

  if (settings.provider === 'msg91') {
    result = await sendViaMSG91(settings.api_key, settings.sender_id, mobile, message);
  } else if (settings.provider === 'twilio') {
    result = await sendViaTwilio(settings.api_key, settings.sender_id, mobile, message);
  } else if (settings.provider === 'fast2sms') {
    result = await sendViaFast2SMS(settings.api_key, mobile, message);
  }

  await execute(`UPDATE sms_logs SET status=?, provider_response=? WHERE id=?`,
    [result.success ? 'sent' : 'failed', result.response, logId]);

  return result.success;
}

export async function sendPaymentSMS(collectionId: string): Promise<void> {
  const col = await queryOne<any>(`
    SELECT col.*, cu.name, cu.mobile, l.loan_no
    FROM collections col JOIN customers cu ON col.customer_id=cu.id JOIN loans l ON col.loan_id=l.id
    WHERE col.id=?
  `, [collectionId]);
  if (!col?.mobile) return;

  const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id=?', ['default']);
  const msg = fillTemplate(settings?.template_payment_success || 'Payment of Rs.{amount} received. Receipt: {receipt}.', {
    name: col.name, mobile: col.mobile, amount: String(col.amount),
    loan_no: col.loan_no, receipt: col.receipt_no,
  });
  await sendSMS(col.customer_id, col.mobile, msg, 'payment_success');
}

export async function sendLoanApprovalSMS(loanId: string): Promise<void> {
  const loan = await queryOne<any>(`
    SELECT l.*, cu.name, cu.mobile
    FROM loans l JOIN customers cu ON l.customer_id=cu.id WHERE l.id=?
  `, [loanId]);
  if (!loan?.mobile) return;

  const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id=?', ['default']);
  const msg = fillTemplate(settings?.template_loan_approved || 'Your loan of Rs.{amount} has been approved. Loan No: {loan_no}.', {
    name: loan.name, mobile: loan.mobile, amount: String(loan.amount),
    loan_no: loan.loan_no, emi: String(loan.emi_amount), freq: loan.emi_frequency,
  });
  await sendSMS(loan.customer_id, loan.mobile, msg, 'loan_approved');
}

export async function sendDueReminderSMS(scheduleId: string): Promise<void> {
  const schedule = await queryOne<any>(`
    SELECT ls.*, l.loan_no, l.penalty_per_day, cu.name, cu.mobile, cu.id as customer_id
    FROM loan_schedule ls JOIN loans l ON ls.loan_id=l.id JOIN customers cu ON l.customer_id=cu.id
    WHERE ls.id=?
  `, [scheduleId]);
  if (!schedule?.mobile) return;

  const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id=?', ['default']);
  const msg = fillTemplate(settings?.template_due_reminder || 'EMI of Rs.{amount} for loan {loan_no} is due on {date}.', {
    name: schedule.name, mobile: schedule.mobile,
    amount: String(schedule.emi_amount), loan_no: schedule.loan_no, date: schedule.due_date,
  });
  await sendSMS(schedule.customer_id, schedule.mobile, msg, 'due_reminder');
}

export async function sendOverdueSMS(loanId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const overdueItems = await queryOne<any>(`
    SELECT ls.*, l.loan_no, cu.name, cu.mobile, cu.id as customer_id,
           DATEDIFF(?, ls.due_date) as days_overdue
    FROM loan_schedule ls JOIN loans l ON ls.loan_id=l.id JOIN customers cu ON l.customer_id=cu.id
    WHERE l.id=? AND ls.status IN ('pending','overdue') AND ls.due_date < ?
    LIMIT 1
  `, [today, loanId, today]);

  if (!overdueItems?.mobile) return;
  const settings = await queryOne<any>('SELECT * FROM sms_settings WHERE id=?', ['default']);
  const msg = fillTemplate(settings?.template_overdue || 'EMI for loan {loan_no} is overdue by {days} days. Amount: Rs.{amount}.', {
    name: overdueItems.name, mobile: overdueItems.mobile,
    loan_no: overdueItems.loan_no, days: String(overdueItems.days_overdue),
    amount: String(overdueItems.emi_amount - overdueItems.paid_amount),
  });
  await sendSMS(overdueItems.customer_id, overdueItems.mobile, msg, 'overdue');
}
