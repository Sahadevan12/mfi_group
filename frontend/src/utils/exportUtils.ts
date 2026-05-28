import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════
// BRAND
// ═══════════════════════════════════════════════════
const NAVY: [number, number, number]      = [15, 30, 68];
const GOLD: [number, number, number]      = [212, 175, 55];
const WHITE: [number, number, number]     = [255, 255, 255];
const GRAY_BG: [number, number, number]   = [248, 250, 252];
const GRAY_BD: [number, number, number]   = [226, 232, 240];
const GREEN: [number, number, number]     = [16, 185, 129];
const RED: [number, number, number]       = [220, 53, 69];
const ORANGE: [number, number, number]    = [245, 158, 11];
const BLUE: [number, number, number]      = [59, 130, 246];

const CO   = 'SPS GROUP OF FOUNDATION';
const ADDR = '28, Street Kallamozhi, Udangudi, Tuticorin';
const PH   = 'PH: 04639-243023  |  CELL: 9788130671';

const inr = (n: any) => `Rs.${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (n: any) => `${Number(n || 0).toFixed(1)}%`;
const ts  = () => format(new Date(), 'dd MMM yyyy, hh:mm a');

// ═══════════════════════════════════════════════════
// PDF HELPERS
// ═══════════════════════════════════════════════════

function makePDF(landscape = true) {
  return new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
}

/** Returns Y after header */
function pdfHdr(doc: jsPDF, title: string, period?: string): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 26, W, 1.5, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(CO, W / 2, 10, { align: 'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(ADDR, W / 2, 16, { align: 'center' });
  doc.text(PH,   W / 2, 21, { align: 'center' });

  doc.setTextColor(...NAVY);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 36);
  let y = 36;
  if (period) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(period, 14, 43);
    y = 43;
  }
  doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
  doc.text(`Generated: ${ts()}`, W - 14, 36, { align: 'right' });
  return y + 7;
}

function pdfBoxes(
  doc: jsPDF,
  items: Array<{ label: string; value: string; color?: [number,number,number] }>,
  y: number,
): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const n = items.length;
  const bW = (W - M * 2 - (n - 1) * 3) / n;
  const H = 15;
  items.forEach((item, i) => {
    const x = M + i * (bW + 3);
    const c = item.color || NAVY;
    doc.setFillColor(...GRAY_BG); doc.setDrawColor(...GRAY_BD);
    doc.roundedRect(x, y, bW, H, 1.5, 1.5, 'FD');
    doc.setFillColor(...c); doc.rect(x, y, 2.5, H, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120); doc.text(item.label, x + 5, y + 5.5);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c); doc.text(item.value, x + 5, y + 12);
  });
  return y + H + 5;
}

function pdfSection(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...NAVY); doc.rect(14, y, 3, 6, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY); doc.text(text, 19, y + 5);
  return y + 10;
}

function pdfTable(
  doc: jsPDF,
  head: string[],
  body: (string | number)[][],
  foot: (string | number)[][] | null,
  startY: number,
  colStyles?: Record<number, any>,
): number {
  autoTable(doc, {
    startY, head: [head], body,
    foot: foot || undefined,
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [40, 40, 40] },
    footStyles: { fillColor: GRAY_BD, textColor: NAVY, fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: GRAY_BG },
    styles: { lineColor: GRAY_BD, lineWidth: 0.2 },
    margin: { left: 14, right: 14 },
    columnStyles: colStyles || {},
    showFoot: foot ? 'lastPage' : 'never',
  });
  return (doc as any).lastAutoTable.finalY + 5;
}

function pdfFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY); doc.rect(0, H - 8, W, 8, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7);
    doc.text('SPS Group of Foundation — Microfinance Management System — Confidential', W / 2, H - 3.5, { align: 'center' });
    doc.text(`Page ${p} of ${pages}`, W - 14, H - 3.5, { align: 'right' });
  }
}

function savePDF(doc: jsPDF, name: string) {
  pdfFooter(doc);
  doc.save(name);
}

// ═══════════════════════════════════════════════════
// EXCEL HELPERS
// ═══════════════════════════════════════════════════

function xlsSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  reportTitle: string,
  period: string,
  headers: string[],
  rows: any[][],
  totals?: any[],
  colWidths?: number[],
) {
  const aoa: any[][] = [
    [CO],
    [reportTitle],
    [period],
    [`Generated: ${ts()}`],
    [],
    headers,
    ...rows,
  ];
  if (totals) aoa.push(totals);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const n = headers.length;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: n - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: n - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: n - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: n - 1 } },
  ];
  ws['!cols'] = (colWidths || headers.map(() => 18)).map(w => ({ wch: w }));
  const safe = sheetName.substring(0, 31).replace(/[[\]:*?/\\]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safe);
}

function saveXLS(wb: XLSX.WorkBook, name: string) {
  XLSX.writeFile(wb, name);
}

// ═══════════════════════════════════════════════════
// 1. DAILY COLLECTION
// ═══════════════════════════════════════════════════

export function exportDailyPDF(data: any, date: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Daily Collection Report', `Date: ${date}`);

  const s = data.summary || {};
  y = pdfBoxes(doc, [
    { label: 'Total Collected',    value: inr(s.total_amount),      color: GREEN  },
    { label: 'Transactions',       value: String(s.total_transactions || 0)        },
    { label: 'Customers Paid',     value: String(s.customers_paid || 0)            },
    { label: 'Loans Paid',         value: String(s.loans_paid || 0)                },
    { label: 'Penalty Collected',  value: inr(s.total_penalty),     color: ORANGE },
  ], y);

  // By Agent
  if (data.byAgent?.length) {
    y = pdfSection(doc, 'Collection by Agent', y);
    y = pdfTable(doc,
      ['Agent Name', 'Transactions', 'Amount (Rs.)'],
      (data.byAgent || []).map((a: any) => [a.agent_name, a.transactions, inr(a.amount)]),
      [['TOTAL', data.byAgent.reduce((s: number, a: any) => s + Number(a.transactions), 0),
        inr(data.byAgent.reduce((s: number, a: any) => s + Number(a.amount), 0))]],
      y,
      { 2: { halign: 'right' } },
    );
  }

  // Details
  y = pdfSection(doc, 'Transaction Details', y);
  pdfTable(doc,
    ['Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Amount (Rs.)'],
    (data.details || []).map((d: any) => [
      d.receipt_no, d.customer_name, d.mobile, d.loan_no,
      d.center_name || '—', d.group_name || '—', d.payment_mode,
      inr(d.amount),
    ]),
    [['', 'TOTAL', '', '', '', '', '', inr(s.total_amount)]],
    y,
    { 7: { halign: 'right' }, 2: { cellWidth: 22 }, 0: { cellWidth: 26 } },
  );

  savePDF(doc, `Daily_Collection_${date}.pdf`);
}

export function exportDailyExcel(data: any, date: string) {
  const wb = XLSX.utils.book_new();
  const s = data.summary || {};

  // Summary sheet
  xlsSheet(wb, 'Summary', 'Daily Collection Report', `Date: ${date}`,
    ['Metric', 'Value'],
    [
      ['Date', date],
      ['Total Collected', `Rs.${Number(s.total_amount||0).toLocaleString('en-IN')}`],
      ['Total Transactions', s.total_transactions || 0],
      ['Customers Paid', s.customers_paid || 0],
      ['Loans Paid', s.loans_paid || 0],
      ['Penalty Collected', `Rs.${Number(s.total_penalty||0).toLocaleString('en-IN')}`],
    ],
    undefined, [35, 25],
  );

  // By Agent
  if (data.byAgent?.length) {
    xlsSheet(wb, 'By Agent', 'Daily Collection — By Agent', `Date: ${date}`,
      ['Agent Name', 'Transactions', 'Amount (Rs.)'],
      (data.byAgent || []).map((a: any) => [a.agent_name, a.transactions, Number(a.amount)]),
      ['TOTAL', data.byAgent.reduce((s: number, a: any) => s + Number(a.transactions), 0),
        data.byAgent.reduce((s: number, a: any) => s + Number(a.amount), 0)],
      [30, 16, 20],
    );
  }

  // Details
  xlsSheet(wb, 'Details', 'Daily Collection — Details', `Date: ${date}`,
    ['Receipt No', 'Customer Name', 'Mobile', 'Loan No', 'Center', 'Group', 'Payment Mode', 'Type', 'Collected By', 'Amount (Rs.)'],
    (data.details || []).map((d: any) => [
      d.receipt_no, d.customer_name, d.mobile, d.loan_no,
      d.center_name||'', d.group_name||'', d.payment_mode, d.payment_type||'',
      d.collected_by_name, Number(d.amount),
    ]),
    ['', 'TOTAL', '', '', '', '', '', '', '',
      (data.details||[]).reduce((s: number, d: any) => s + Number(d.amount), 0)],
    [22, 25, 14, 18, 20, 20, 16, 14, 20, 16],
  );

  saveXLS(wb, `Daily_Collection_${date}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 2. WEEKLY COLLECTION
// ═══════════════════════════════════════════════════

export function exportWeeklyPDF(data: any) {
  const doc = makePDF(true);
  const period = `Period: ${data.from}  to  ${data.to}`;
  let y = pdfHdr(doc, 'Weekly Collection Report', period);

  const s = data.summary || {};
  y = pdfBoxes(doc, [
    { label: 'Total Collected',   value: inr(s.total_amount),  color: GREEN  },
    { label: 'Transactions',      value: String(s.total_transactions || 0)   },
    { label: 'Customers Paid',    value: String(s.customers_paid || 0)       },
    { label: 'Penalty Collected', value: inr(s.total_penalty), color: ORANGE },
  ], y);

  // Daily trend
  y = pdfSection(doc, 'Day-wise Trend', y);
  y = pdfTable(doc,
    ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily || []).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
    [['TOTAL', s.total_transactions, inr(s.total_amount)]],
    y, { 2: { halign: 'right' } },
  );

  // By Center
  y = pdfSection(doc, 'Center-wise Breakup', y);
  y = pdfTable(doc,
    ['Center', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter || []).map((c: any) => [c.center_name || '—', c.transactions, inr(c.amount)]),
    [['TOTAL', (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))]],
    y, { 2: { halign: 'right' } },
  );

  // By Group
  y = pdfSection(doc, 'Group-wise Breakup', y);
  y = pdfTable(doc,
    ['Group', 'Center', 'Transactions', 'Amount (Rs.)'],
    (data.byGroup || []).map((g: any) => [g.group_name||'—', g.center_name||'—', g.transactions, inr(g.amount)]),
    [['TOTAL', '', (data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.transactions), 0),
      inr((data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.amount), 0))]],
    y, { 3: { halign: 'right' } },
  );

  // Details
  y = pdfSection(doc, 'All Transactions', y);
  pdfTable(doc,
    ['Date', 'Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Collected By', 'Amount (Rs.)'],
    (data.details || []).map((d: any) => [
      d.payment_date, d.receipt_no, d.customer_name, d.mobile, d.loan_no,
      d.center_name||'—', d.group_name||'—', d.payment_mode, d.collected_by_name, inr(d.amount),
    ]),
    [['', '', 'TOTAL', '', '', '', '', '', '', inr(s.total_amount)]],
    y, { 9: { halign: 'right' }, 2: { cellWidth: 24 } },
  );

  savePDF(doc, `Weekly_Collection_${data.from}_${data.to}.pdf`);
}

export function exportWeeklyExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${data.from} to ${data.to}`;
  const s = data.summary || {};

  xlsSheet(wb, 'Summary', 'Weekly Collection Report', period,
    ['Metric', 'Value'],
    [
      ['Period', `${data.from} to ${data.to}`],
      ['Total Collected', Number(s.total_amount||0)],
      ['Total Transactions', Number(s.total_transactions||0)],
      ['Customers Paid', Number(s.customers_paid||0)],
      ['Penalty Collected', Number(s.total_penalty||0)],
    ],
    undefined, [30, 22],
  );

  xlsSheet(wb, 'Daily Trend', 'Weekly — Day-wise', period,
    ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily||[]).map((d: any) => [d.payment_date, Number(d.transactions), Number(d.amount)]),
    ['TOTAL', Number(s.total_transactions||0), Number(s.total_amount||0)],
    [16, 14, 18],
  );

  xlsSheet(wb, 'By Center', 'Weekly — Center-wise', period,
    ['Center Name', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter||[]).map((c: any) => [c.center_name||'—', Number(c.transactions), Number(c.amount)]),
    ['TOTAL',
      (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0)],
    [28, 16, 18],
  );

  xlsSheet(wb, 'By Group', 'Weekly — Group-wise', period,
    ['Group Name', 'Center', 'Transactions', 'Amount (Rs.)'],
    (data.byGroup||[]).map((g: any) => [g.group_name||'—', g.center_name||'—', Number(g.transactions), Number(g.amount)]),
    ['TOTAL', '',
      (data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.transactions), 0),
      (data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.amount), 0)],
    [28, 24, 16, 18],
  );

  xlsSheet(wb, 'All Transactions', 'Weekly — All Transactions', period,
    ['Date', 'Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Collected By', 'Amount (Rs.)'],
    (data.details||[]).map((d: any) => [
      d.payment_date, d.receipt_no, d.customer_name, d.mobile, d.loan_no,
      d.center_name||'', d.group_name||'', d.payment_mode, d.collected_by_name, Number(d.amount),
    ]),
    ['', '', 'TOTAL', '', '', '', '', '', '',
      (data.details||[]).reduce((s: number, d: any) => s + Number(d.amount), 0)],
    [14, 22, 24, 14, 18, 20, 20, 14, 20, 16],
  );

  saveXLS(wb, `Weekly_Collection_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 3. MONTHLY COLLECTION
// ═══════════════════════════════════════════════════

export function exportMonthlyPDF(data: any) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Monthly Collection Report', `Month: ${data.month}`);

  const s = data.summary || {};
  y = pdfBoxes(doc, [
    { label: 'Total Collected',  value: inr(s.total_amount),          color: GREEN },
    { label: 'Transactions',     value: String(s.transactions || 0)               },
    { label: 'Unique Customers', value: String(s.unique_customers || 0)           },
  ], y);

  // Daily trend
  y = pdfSection(doc, 'Day-wise Collection', y);
  y = pdfTable(doc,
    ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily||[]).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
    [['TOTAL', s.transactions, inr(s.total_amount)]],
    y, { 2: { halign: 'right' } },
  );

  // By Center
  y = pdfSection(doc, 'Center-wise Collection', y);
  pdfTable(doc,
    ['Center', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter||[]).map((c: any) => [c.center_name||'—', c.transactions, inr(c.amount)]),
    [['TOTAL',
      (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))]],
    y, { 2: { halign: 'right' } },
  );

  savePDF(doc, `Monthly_Collection_${data.month}.pdf`);
}

export function exportMonthlyExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const s = data.summary || {};

  xlsSheet(wb, 'Summary', 'Monthly Collection Report', `Month: ${data.month}`,
    ['Metric', 'Value'],
    [
      ['Month', data.month],
      ['Total Collected', Number(s.total_amount||0)],
      ['Total Transactions', Number(s.transactions||0)],
      ['Unique Customers', Number(s.unique_customers||0)],
    ],
    undefined, [30, 22],
  );

  xlsSheet(wb, 'Daily Trend', 'Monthly — Day-wise', `Month: ${data.month}`,
    ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily||[]).map((d: any) => [d.payment_date, Number(d.transactions), Number(d.amount)]),
    ['TOTAL', Number(s.transactions||0), Number(s.total_amount||0)],
    [16, 14, 18],
  );

  xlsSheet(wb, 'By Center', 'Monthly — Center-wise', `Month: ${data.month}`,
    ['Center Name', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter||[]).map((c: any) => [c.center_name||'—', Number(c.transactions), Number(c.amount)]),
    ['TOTAL',
      (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0)],
    [28, 16, 18],
  );

  saveXLS(wb, `Monthly_Collection_${data.month}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 4. PENDING DUES
// ═══════════════════════════════════════════════════

export function exportPendingPDF(data: any) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Pending Dues Report', `As of: ${format(new Date(), 'dd MMM yyyy')}`);

  y = pdfBoxes(doc, [
    { label: 'Total Pending Amount', value: inr(data.totalPending), color: RED    },
    { label: 'Loans Affected',       value: String(data.count || 0), color: ORANGE },
  ], y);

  pdfTable(doc,
    ['Customer', 'Mobile', 'Loan No', 'Frequency', 'Center', 'Group', 'Earliest Due', 'Pending EMIs', 'Days Overdue', 'Pending Amount (Rs.)'],
    (data.dues||[]).map((d: any) => [
      d.customer_name, d.mobile, d.loan_no, d.emi_frequency||'—',
      d.center_name||'—', d.group_name||'—', d.earliest_due||'—',
      d.pending_installments, d.max_days_overdue > 0 ? `${d.max_days_overdue} days` : '0',
      inr(d.pending_amount),
    ]),
    [['', '', '', '', '', '', '', '', 'TOTAL', inr(data.totalPending)]],
    y, { 9: { halign: 'right' }, 8: { halign: 'right' } },
  );

  savePDF(doc, `Pending_Dues_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportPendingExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const today = format(new Date(), 'dd MMM yyyy');

  xlsSheet(wb, 'Summary', 'Pending Dues Report', `As of: ${today}`,
    ['Metric', 'Value'],
    [
      ['Report Date', today],
      ['Total Pending Amount (Rs.)', Number(data.totalPending||0)],
      ['Loans Affected', Number(data.count||0)],
    ],
    undefined, [35, 22],
  );

  xlsSheet(wb, 'Pending Dues', 'Pending Dues — Details', `As of: ${today}`,
    ['Customer', 'Mobile', 'Loan No', 'EMI Frequency', 'Center', 'Group', 'Earliest Due Date', 'Pending EMIs', 'Max Days Overdue', 'Pending Amount (Rs.)'],
    (data.dues||[]).map((d: any) => [
      d.customer_name, d.mobile, d.loan_no, d.emi_frequency||'',
      d.center_name||'', d.group_name||'', d.earliest_due||'',
      Number(d.pending_installments), Number(d.max_days_overdue),
      Number(d.pending_amount),
    ]),
    ['', '', '', '', '', '', '', '', 'TOTAL', Number(data.totalPending||0)],
    [24, 14, 18, 14, 20, 20, 18, 14, 16, 20],
  );

  saveXLS(wb, `Pending_Dues_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 5. DEFAULTERS
// ═══════════════════════════════════════════════════

export function exportDefaultersPDF(rows: any[]) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Defaulters Report', `Loans overdue 30+ days — As of: ${format(new Date(), 'dd MMM yyyy')}`);

  const totalOutstanding = rows.reduce((s, d) => s + Number(d.outstanding||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Defaulters',     value: String(rows.length),    color: RED    },
    { label: 'Total Outstanding',    value: inr(totalOutstanding),  color: RED    },
    { label: 'Avg Days Overdue',
      value: rows.length ? `${Math.round(rows.reduce((s, d) => s + Number(d.days_overdue||0), 0) / rows.length)} days` : '—',
      color: ORANGE },
  ], y);

  pdfTable(doc,
    ['Customer', 'Mobile', 'Loan No', 'Loan Amount (Rs.)', 'Total Paid (Rs.)', 'Outstanding (Rs.)', 'Overdue Since', 'Days Overdue', 'Overdue EMIs', 'Center', 'Group'],
    rows.map((d: any) => [
      d.name, d.mobile, d.loan_no,
      inr(d.amount), inr(d.total_paid), inr(d.outstanding),
      d.overdue_since||'—', `${d.days_overdue||0} days`,
      d.overdue_installments||0,
      d.center_name||'—', d.group_name||'—',
    ]),
    [['', '', '', '', 'TOTAL OUTSTANDING', inr(totalOutstanding), '', '', '', '', '']],
    y,
    { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  );

  savePDF(doc, `Defaulters_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportDefaultersExcel(rows: any[]) {
  const wb = XLSX.utils.book_new();
  const today = format(new Date(), 'dd MMM yyyy');
  const totalOutstanding = rows.reduce((s, d) => s + Number(d.outstanding||0), 0);

  xlsSheet(wb, 'Summary', 'Defaulters Report', `As of: ${today}`,
    ['Metric', 'Value'],
    [
      ['Report Date', today],
      ['Total Defaulters', rows.length],
      ['Total Outstanding (Rs.)', totalOutstanding],
      ['Avg Days Overdue', rows.length ? Math.round(rows.reduce((s, d) => s + Number(d.days_overdue||0), 0) / rows.length) : 0],
    ],
    undefined, [35, 22],
  );

  xlsSheet(wb, 'Defaulters', 'Defaulters — Details', `As of: ${today}`,
    ['Customer', 'Mobile', 'Address', 'Loan No', 'Loan Amount (Rs.)', 'Total Paid (Rs.)', 'Outstanding (Rs.)', 'Overdue Since', 'Days Overdue', 'Overdue EMIs', 'Center', 'Group'],
    rows.map((d: any) => [
      d.name, d.mobile, d.address||'', d.loan_no,
      Number(d.amount), Number(d.total_paid), Number(d.outstanding||0),
      d.overdue_since||'', Number(d.days_overdue||0),
      Number(d.overdue_installments||0),
      d.center_name||'', d.group_name||'',
    ]),
    ['', '', '', '', '', '', totalOutstanding, '', '', '', '', ''],
    [24, 14, 28, 18, 18, 18, 18, 14, 14, 14, 20, 20],
  );

  saveXLS(wb, `Defaulters_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 6. CENTER-WISE
// ═══════════════════════════════════════════════════

export function exportCenterWisePDF(rows: any[], from: string, to: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Center-wise Report', `Period: ${from}  to  ${to}`);

  const totalCol = rows.reduce((s, c) => s + Number(c.collected||0), 0);
  const totalCust = rows.reduce((s, c) => s + Number(c.customers||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Centers',    value: String(rows.length)               },
    { label: 'Total Customers',  value: String(totalCust)                  },
    { label: 'Total Collected',  value: inr(totalCol),      color: GREEN  },
    { label: 'Total Active Loans',
      value: String(rows.reduce((s, c) => s + Number(c.active_loans||0), 0)) },
  ], y);

  pdfTable(doc,
    ['Center Name', 'Area', 'Customers', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((c: any) => [
      c.name, c.area||'—', c.customers, c.active_loans,
      inr(c.collected), inr(c.pending_amount),
    ]),
    [['TOTAL', '', totalCust,
      rows.reduce((s, c) => s + Number(c.active_loans||0), 0),
      inr(totalCol),
      inr(rows.reduce((s, c) => s + Number(c.pending_amount||0), 0))]],
    y,
    { 4: { halign: 'right' }, 5: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  );

  savePDF(doc, `Center_Wise_${from}_${to}.pdf`);
}

export function exportCenterWiseExcel(rows: any[], from: string, to: string) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${from} to ${to}`;

  xlsSheet(wb, 'Summary', 'Center-wise Report — Summary', period,
    ['Metric', 'Value'],
    [
      ['Period', `${from} to ${to}`],
      ['Total Centers', rows.length],
      ['Total Customers', rows.reduce((s, c) => s + Number(c.customers||0), 0)],
      ['Total Active Loans', rows.reduce((s, c) => s + Number(c.active_loans||0), 0)],
      ['Total Collected (Rs.)', rows.reduce((s, c) => s + Number(c.collected||0), 0)],
      ['Total Pending (Rs.)', rows.reduce((s, c) => s + Number(c.pending_amount||0), 0)],
    ],
    undefined, [35, 22],
  );

  xlsSheet(wb, 'Center-wise', 'Center-wise Report', period,
    ['Center Name', 'Area', 'Customers', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((c: any) => [
      c.name, c.area||'', Number(c.customers), Number(c.active_loans),
      Number(c.collected), Number(c.pending_amount||0),
    ]),
    ['TOTAL', '',
      rows.reduce((s, c) => s + Number(c.customers||0), 0),
      rows.reduce((s, c) => s + Number(c.active_loans||0), 0),
      rows.reduce((s, c) => s + Number(c.collected||0), 0),
      rows.reduce((s, c) => s + Number(c.pending_amount||0), 0)],
    [28, 22, 14, 14, 20, 22],
  );

  saveXLS(wb, `Center_Wise_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 7. GROUP-WISE
// ═══════════════════════════════════════════════════

export function exportGroupWisePDF(rows: any[], from: string, to: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Group-wise Report', `Period: ${from}  to  ${to}`);

  const totalCol = rows.reduce((s, g) => s + Number(g.collected||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Groups',      value: String(rows.length)              },
    { label: 'Total Members',     value: String(rows.reduce((s, g) => s + Number(g.members||0), 0)) },
    { label: 'Total Collected',   value: inr(totalCol),     color: GREEN  },
    { label: 'Total Pending',
      value: inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0)), color: ORANGE },
  ], y);

  pdfTable(doc,
    ['Group Name', 'Center', 'Members', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((g: any) => [
      g.group_name, g.center_name||'—', g.members, g.active_loans,
      inr(g.collected), inr(g.pending_amount),
    ]),
    [['TOTAL', '',
      rows.reduce((s, g) => s + Number(g.members||0), 0),
      rows.reduce((s, g) => s + Number(g.active_loans||0), 0),
      inr(totalCol),
      inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0))]],
    y,
    { 4: { halign: 'right' }, 5: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  );

  savePDF(doc, `Group_Wise_${from}_${to}.pdf`);
}

export function exportGroupWiseExcel(rows: any[], from: string, to: string) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${from} to ${to}`;

  xlsSheet(wb, 'Summary', 'Group-wise Report — Summary', period,
    ['Metric', 'Value'],
    [
      ['Period', `${from} to ${to}`],
      ['Total Groups', rows.length],
      ['Total Members', rows.reduce((s, g) => s + Number(g.members||0), 0)],
      ['Total Active Loans', rows.reduce((s, g) => s + Number(g.active_loans||0), 0)],
      ['Total Collected (Rs.)', rows.reduce((s, g) => s + Number(g.collected||0), 0)],
      ['Total Pending (Rs.)', rows.reduce((s, g) => s + Number(g.pending_amount||0), 0)],
    ],
    undefined, [35, 22],
  );

  xlsSheet(wb, 'Group-wise', 'Group-wise Report', period,
    ['Group Name', 'Center', 'Members', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((g: any) => [
      g.group_name, g.center_name||'', Number(g.members), Number(g.active_loans),
      Number(g.collected), Number(g.pending_amount||0),
    ]),
    ['TOTAL', '',
      rows.reduce((s, g) => s + Number(g.members||0), 0),
      rows.reduce((s, g) => s + Number(g.active_loans||0), 0),
      rows.reduce((s, g) => s + Number(g.collected||0), 0),
      rows.reduce((s, g) => s + Number(g.pending_amount||0), 0)],
    [28, 24, 14, 14, 20, 22],
  );

  saveXLS(wb, `Group_Wise_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 8. AGENT-WISE
// ═══════════════════════════════════════════════════

export function exportAgentWisePDF(data: any) {
  const doc = makePDF(true);
  const period = `Period: ${data.from}  to  ${data.to}`;
  let y = pdfHdr(doc, 'Agent-wise Collection Report', period);

  const agents = data.agents || [];
  const totalAmt = agents.reduce((s: number, a: any) => s + Number(a.total_amount||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Active Agents',     value: String(agents.filter((a: any) => Number(a.total_amount) > 0).length) },
    { label: 'Total Collected',   value: inr(totalAmt),  color: GREEN  },
    { label: 'Total Collections', value: String(agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0)) },
    { label: 'Unique Customers',  value: String(agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0)) },
  ], y);

  pdfTable(doc,
    ['Agent Name', 'Phone', 'Total Collections', 'Unique Customers', 'Working Days', 'Total Amount (Rs.)'],
    agents.map((a: any) => [
      a.name, a.phone||'—', a.total_collections, a.unique_customers,
      a.working_days, inr(a.total_amount),
    ]),
    [['TOTAL', '',
      agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0),
      agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0),
      '—',
      inr(totalAmt)]],
    y, { 5: { halign: 'right' } },
  );

  // Daily trend per agent
  if (data.dailyTrend?.length) {
    y = pdfSection(doc, 'Daily Trend by Agent', (doc as any).lastAutoTable.finalY + 8);
    const grouped: Record<string, any> = {};
    data.dailyTrend.forEach((d: any) => {
      if (!grouped[d.payment_date]) grouped[d.payment_date] = { date: d.payment_date };
      grouped[d.payment_date][d.agent_name] = inr(d.amount);
    });
    const agentNames = agents.map((a: any) => a.name);
    pdfTable(doc,
      ['Date', ...agentNames],
      Object.values(grouped).map((row: any) => [row.date, ...agentNames.map((n: string) => row[n] || '—')]),
      null, y,
    );
  }

  savePDF(doc, `Agent_Wise_${data.from}_${data.to}.pdf`);
}

export function exportAgentWiseExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${data.from} to ${data.to}`;
  const agents = data.agents || [];
  const totalAmt = agents.reduce((s: number, a: any) => s + Number(a.total_amount||0), 0);

  xlsSheet(wb, 'Summary', 'Agent-wise Report — Summary', period,
    ['Metric', 'Value'],
    [
      ['Period', `${data.from} to ${data.to}`],
      ['Active Agents', agents.filter((a: any) => Number(a.total_amount) > 0).length],
      ['Total Collected (Rs.)', totalAmt],
      ['Total Collections', agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0)],
    ],
    undefined, [35, 22],
  );

  xlsSheet(wb, 'Agent-wise', 'Agent-wise Report', period,
    ['Agent Name', 'Phone', 'Email', 'Total Collections', 'Unique Customers', 'Working Days', 'Total Amount (Rs.)'],
    agents.map((a: any) => [
      a.name, a.phone||'', a.email||'',
      Number(a.total_collections), Number(a.unique_customers),
      Number(a.working_days), Number(a.total_amount),
    ]),
    ['TOTAL', '', '',
      agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0),
      agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0),
      '', totalAmt],
    [28, 16, 28, 18, 18, 14, 20],
  );

  // Daily trend
  if (data.dailyTrend?.length) {
    const agentNames = agents.map((a: any) => a.name);
    const grouped: Record<string, any> = {};
    data.dailyTrend.forEach((d: any) => {
      if (!grouped[d.payment_date]) grouped[d.payment_date] = { date: d.payment_date };
      grouped[d.payment_date][d.agent_name] = Number(d.amount);
    });
    xlsSheet(wb, 'Daily Trend', 'Agent — Daily Trend', period,
      ['Date', ...agentNames],
      Object.values(grouped).map((row: any) => [row.date, ...agentNames.map((n: string) => row[n] || 0)]),
      undefined,
      [14, ...agentNames.map(() => 18)],
    );
  }

  saveXLS(wb, `Agent_Wise_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 9. PROFIT & LOSS
// ═══════════════════════════════════════════════════

export function exportPLPDF(data: any) {
  const doc = makePDF(false); // portrait
  let y = pdfHdr(doc, 'Profit & Loss Statement', `Period: ${data.from}  to  ${data.to}`);

  const inc = data.income || {};
  const exp = data.expenses || {};
  y = pdfBoxes(doc, [
    { label: 'Gross Income',    value: inr(inc.gross_income),  color: GREEN },
    { label: 'Total Expenses',  value: inr(exp.total),         color: RED   },
    { label: 'Net Profit',      value: inr(data.net_profit),
      color: data.net_profit >= 0 ? GREEN : RED },
  ], y);

  // Income section
  y = pdfSection(doc, 'Income Breakdown', y);
  y = pdfTable(doc,
    ['Income Category', 'Amount (Rs.)'],
    [
      ['Total Collections',    inr(inc.total_collected)],
      ['Interest Income',      inr(inc.interest_income)],
      ['Penalty Income',       inr(inc.penalty_income)],
      ['Processing Fees',      inr(inc.processing_fees)],
    ],
    [['GROSS INCOME', inr(inc.gross_income)]],
    y, { 1: { halign: 'right' } },
  );

  // Expense section
  y = pdfSection(doc, 'Expense Breakdown', y);
  y = pdfTable(doc,
    ['Expense Category', 'Amount (Rs.)'],
    (exp.breakdown||[]).map((e: any) => [
      e.category.replace(/_/g, ' ').toUpperCase(), inr(e.amount),
    ]),
    [['TOTAL EXPENSES', inr(exp.total)]],
    y, { 1: { halign: 'right' } },
  );

  // Monthly trend
  if (data.monthly?.length) {
    y = pdfSection(doc, 'Monthly Trend', y);
    pdfTable(doc,
      ['Month', 'Collections (Rs.)'],
      data.monthly.map((m: any) => [m.month, inr(m.collections)]),
      null, y, { 1: { halign: 'right' } },
    );
  }

  savePDF(doc, `Profit_Loss_${data.from}_${data.to}.pdf`);
}

export function exportPLExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${data.from} to ${data.to}`;
  const inc = data.income || {};
  const exp = data.expenses || {};

  // P&L Statement sheet
  xlsSheet(wb, 'P&L Statement', 'Profit & Loss Statement', period,
    ['Category', 'Amount (Rs.)'],
    [
      ['INCOME', ''],
      ['Total Collections', Number(inc.total_collected||0)],
      ['Interest Income', Number(inc.interest_income||0)],
      ['Penalty Income', Number(inc.penalty_income||0)],
      ['Processing Fees', Number(inc.processing_fees||0)],
      ['GROSS INCOME', Number(inc.gross_income||0)],
      ['', ''],
      ['EXPENSES', ''],
      ...(exp.breakdown||[]).map((e: any) => [e.category.replace(/_/g,' ').toUpperCase(), Number(e.amount)]),
      ['TOTAL EXPENSES', Number(exp.total||0)],
      ['', ''],
      ['NET PROFIT / LOSS', Number(data.net_profit||0)],
    ],
    undefined, [35, 22],
  );

  // Monthly trend
  if (data.monthly?.length) {
    xlsSheet(wb, 'Monthly Trend', 'P&L — Monthly Trend', period,
      ['Month', 'Collections (Rs.)'],
      data.monthly.map((m: any) => [m.month, Number(m.collections)]),
      ['TOTAL', data.monthly.reduce((s: number, m: any) => s + Number(m.collections), 0)],
      [18, 20],
    );
  }

  saveXLS(wb, `Profit_Loss_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 10. CASH BOOK
// ═══════════════════════════════════════════════════

export function exportCashbookPDF(data: any, from: string, to: string) {
  const doc = makePDF(false); // portrait
  let y = pdfHdr(doc, 'Cash Book', `Period: ${from}  to  ${to}`);

  y = pdfBoxes(doc, [
    { label: 'Total Income (Collections)', value: inr(data.totalIncome),    color: GREEN  },
    { label: 'Loans Disbursed',            value: inr(data.totalDisbursed), color: BLUE   },
    { label: 'Total Expenses',             value: inr(data.totalExpenses),  color: RED    },
    { label: 'Net Balance',                value: inr(data.netProfit),
      color: data.netProfit >= 0 ? GREEN : RED },
  ], y);

  // Income
  y = pdfSection(doc, 'Collections (Cash In)', y);
  y = pdfTable(doc,
    ['Date', 'Type', 'Amount (Rs.)'],
    (data.income||[]).map((i: any) => [i.date, 'Collection', inr(i.amount)]),
    [['', 'TOTAL INCOME', inr(data.totalIncome)]],
    y, { 2: { halign: 'right' } },
  );

  // Disbursements
  y = pdfSection(doc, 'Loan Disbursements (Cash Out)', y);
  y = pdfTable(doc,
    ['Date', 'Loans', 'Loan Numbers', 'Amount (Rs.)'],
    (data.disbursements||[]).map((d: any) => [d.date, `${d.count} loan(s)`, d.loan_nos||'', inr(d.amount)]),
    [['', '', 'TOTAL DISBURSED', inr(data.totalDisbursed)]],
    y, { 3: { halign: 'right' } },
  );

  // Expenses
  y = pdfSection(doc, 'Expenses (Cash Out)', y);
  pdfTable(doc,
    ['Date', 'Category', 'Amount (Rs.)'],
    (data.expenses||[]).map((e: any) => [e.date, e.type, inr(e.amount)]),
    [['', 'TOTAL EXPENSES', inr(data.totalExpenses)]],
    y, { 2: { halign: 'right' } },
  );

  savePDF(doc, `Cash_Book_${from}_${to}.pdf`);
}

export function exportCashbookExcel(data: any, from: string, to: string) {
  const wb = XLSX.utils.book_new();
  const period = `Period: ${from} to ${to}`;

  // Summary sheet
  xlsSheet(wb, 'Summary', 'Cash Book — Summary', period,
    ['Category', 'Amount (Rs.)'],
    [
      ['Total Collections (Income)', Number(data.totalIncome||0)],
      ['Total Loans Disbursed (Outflow)', Number(data.totalDisbursed||0)],
      ['Total Expenses (Outflow)', Number(data.totalExpenses||0)],
      ['NET BALANCE', Number(data.netProfit||0)],
    ],
    undefined, [40, 22],
  );

  // Collections
  xlsSheet(wb, 'Collections', 'Cash Book — Collections', period,
    ['Date', 'Type', 'Amount (Rs.)'],
    (data.income||[]).map((i: any) => [i.date, 'Collection', Number(i.amount)]),
    ['', 'TOTAL', Number(data.totalIncome||0)],
    [16, 18, 18],
  );

  // Disbursements
  xlsSheet(wb, 'Disbursements', 'Cash Book — Loan Disbursements', period,
    ['Date', 'No. of Loans', 'Loan Numbers', 'Amount (Rs.)'],
    (data.disbursements||[]).map((d: any) => [d.date, Number(d.count), d.loan_nos||'', Number(d.amount)]),
    ['', '', 'TOTAL', Number(data.totalDisbursed||0)],
    [16, 14, 50, 18],
  );

  // Expenses
  xlsSheet(wb, 'Expenses', 'Cash Book — Expenses', period,
    ['Date', 'Category', 'Amount (Rs.)'],
    (data.expenses||[]).map((e: any) => [e.date, e.type, Number(e.amount)]),
    ['', 'TOTAL', Number(data.totalExpenses||0)],
    [16, 24, 18],
  );

  saveXLS(wb, `Cash_Book_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// CENTER COLLECTION SHEET (SPS Excel Format)
// ═══════════════════════════════════════════════════

export function exportCenterCollectionSheet(data: {
  date: string;
  centers: Array<{
    name: string; area?: string; meeting_day?: string; meeting_time?: string;
    members: Array<{ name: string; mobile: string; loan_amount: number; emi_amount: number; installment_no?: number; paid_today?: number }>;
  }>;
}) {
  const wb = XLSX.utils.book_new();
  const [y, m, d] = data.date.split('-');
  const displayDate = `${d}/${m}/${y}`;

  for (const center of data.centers) {
    const rows: any[][] = [];
    rows.push([CO, '', '', '', '', '', '', '', '', '', '']);
    rows.push(['WEEKLY CENTER COLLECTION SHEET', '', '', '', '', '', '', '', '', '', '']);
    rows.push([`${ADDR} | ${PH}`, '', '', '', '', '', '', '', '', '', '']);
    rows.push([]);
    rows.push(['DAY ORDER:', center.meeting_day||'', '', 'CENTER NAME:', center.name, '', 'DATE:', displayDate, '', 'CENTER TIME:', center.meeting_time||'']);
    rows.push([]);
    rows.push(['S.NO', 'MEMBER NAME', 'MOBILE NUMBER', 'LOAN AMOUNT', 'EMI', 'PAID WEEK', 'RM SIGN', '', '', '', '']);

    center.members.forEach((m, idx) => {
      rows.push([idx+1, m.name, m.mobile, m.loan_amount, m.emi_amount, m.installment_no||'', '', '', '', '', '']);
    });
    for (let i = center.members.length + 1; i <= 10; i++) {
      rows.push([i, '', '', '', '', '', '', '', '', '', '']);
    }
    rows.push(['TOTAL', '', '', '', '', '', '', '', '', '', '']);
    rows.push([]);
    rows.push(['TOTAL CASH :', '', '', 'BM SIGN:', '', '', 'CENTER LEADER SIGN:', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    ];
    XLSX.utils.book_append_sheet(wb, ws, center.name.substring(0, 31).replace(/[[\]:*?/\\]/g, '_'));
  }

  // Denomination sheet
  const dRows = [
    ['DENOMINATION SHEET','','','',''], [],
    ['S.NO','NOTE','COUNT','RUPEES',''],
    [1,'500','','',''],[2,'200','','',''],[3,'100','','',''],[4,'50','','',''],
    [5,'20','','',''],[6,'10','','',''],[7,'20 COIN','','',''],[8,'10 COIN','','',''],
    [9,'5 COIN','','',''],[10,'COINS','','',''],
    ['TOTAL','','','',''], [], ['CENTER LEADER SIGN:','','','',''],
  ];
  const dWs = XLSX.utils.aoa_to_sheet(dRows);
  dWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, dWs, 'Denomination');

  XLSX.writeFile(wb, `Center_Collection_Sheet_${data.date}.xlsx`);
}

// ═══════════════════════════════════════════════════
// RECEIPT PDF (unchanged)
// ═══════════════════════════════════════════════════

export function exportReceiptPDF(receipt: {
  receipt_no: string; amount: number; penalty_paid: number; payment_date: string;
  payment_mode: string; customer_name: string; mobile: string; loan_no: string;
  loan_amount: number; collected_by_name: string; center_name?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 130] });
  const navy: [number,number,number] = [15, 30, 68];
  const gold: [number,number,number] = [212, 175, 55];

  doc.setFillColor(...navy); doc.rect(0, 0, 80, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('SPS Group of Foundation', 40, 9, { align: 'center' });
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('Microfinance Payment Receipt', 40, 15, { align: 'center' });
  doc.text(`Receipt #: ${receipt.receipt_no}`, 40, 20, { align: 'center' });

  doc.setTextColor(30, 30, 30);
  const left = 8; let y = 30; const lH = 7;
  function row(label: string, value: string, bold = false) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(label, left, y);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(30, 30, 30);
    doc.text(value, 72, y, { align: 'right' }); y += lH;
  }
  row('Customer', receipt.customer_name);
  row('Mobile', receipt.mobile);
  row('Loan No', receipt.loan_no);
  row('Date', format(new Date(receipt.payment_date), 'dd MMM yyyy'));
  row('Mode', receipt.payment_mode.toUpperCase());

  doc.setDrawColor(...gold); doc.setLineWidth(0.5); doc.line(left, y, 72, y); y += 4;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
  doc.text('Amount Paid', left, y);
  doc.text(`Rs. ${receipt.amount.toFixed(2)}`, 72, y, { align: 'right' }); y += lH;

  if (receipt.penalty_paid > 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 0, 0);
    doc.text('Penalty', left, y);
    doc.text(`Rs. ${receipt.penalty_paid.toFixed(2)}`, 72, y, { align: 'right' }); y += lH;
  }

  doc.setDrawColor(200, 200, 200); doc.line(left, y, 72, y); y += 4;
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
  row('Collected by', receipt.collected_by_name);
  if (receipt.center_name) row('Center', receipt.center_name);

  y += 2; doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text('Thank you for your payment!', 40, y, { align: 'center' }); y += 5;
  doc.text('This is a computer-generated receipt.', 40, y, { align: 'center' });

  doc.save(`Receipt_${receipt.receipt_no}.pdf`);
}

// ═══════════════════════════════════════════════════
// LEGACY (kept for any other callers)
// ═══════════════════════════════════════════════════

export function exportPDF(
  title: string,
  columns: { header: string; dataKey: string }[],
  rows: Record<string, any>[],
  filename?: string,
) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, title);
  pdfTable(doc,
    columns.map(c => c.header),
    rows.map(row => columns.map(c => row[c.dataKey] ?? '')),
    null, y,
  );
  savePDF(doc, filename || `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportExcel(
  sheetName: string,
  columns: { header: string; dataKey: string }[],
  rows: Record<string, any>[],
  filename?: string,
) {
  const wb = XLSX.utils.book_new();
  xlsSheet(wb, sheetName, sheetName, ts(), columns.map(c => c.header),
    rows.map(row => columns.map(c => row[c.dataKey] ?? '')),
  );
  saveXLS(wb, filename || `${sheetName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}
