import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export function exportPDF(
  title: string,
  columns: { header: string; dataKey: string }[],
  rows: Record<string, any>[],
  filename?: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(15, 30, 68); // navy
  doc.text('SPS Group of Foundation', 14, 14);
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(title, 14, 21);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 27);

  autoTable(doc, {
    startY: 32,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => row[c.dataKey] ?? '')),
    headStyles: { fillColor: [15, 30, 68], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename || `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportExcel(
  sheetName: string,
  columns: { header: string; dataKey: string }[],
  rows: Record<string, any>[],
  filename?: string
) {
  const headers = columns.map(c => c.header);
  const data = rows.map(row => columns.map(c => row[c.dataKey] ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  ws['!cols'] = columns.map(() => ({ wch: 18 }));

  // Header style (limited in xlsx community edition)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  XLSX.writeFile(wb, filename || `${sheetName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ─── Center Collection Sheet (matches SPS_Center_Collection_Sheet.xlsx format) ───
export function exportCenterCollectionSheet(data: {
  date: string;
  centers: Array<{
    name: string;
    area?: string;
    meeting_day?: string;
    meeting_time?: string;
    members: Array<{
      name: string;
      mobile: string;
      loan_amount: number;
      emi_amount: number;
      installment_no?: number;
      paid_today?: number;
    }>;
  }>;
}) {
  const wb = XLSX.utils.book_new();
  const displayDate = (() => {
    const [y, m, d] = data.date.split('-');
    return `${d}/${m}/${y}`;
  })();

  for (const center of data.centers) {
    const rows: any[][] = [];

    rows.push(['SPS GROUP FOUNDATION', '', '', '', '', '', '', '', '', '', '']);
    rows.push(['WEEKLY CENTER COLLECTION SHEET', '', '', '', '', '', '', '', '', '', '']);
    rows.push(['28, Street Kallamozhi, Udangudi, Tuticorin | PH: 04639-243023 | CELL: 9788130671', '', '', '', '', '', '', '', '', '', '']);
    rows.push([]);
    rows.push([
      'DAY ORDER:', center.meeting_day || '',  '',
      'CENTER NAME:', center.name,             '',
      'DATE:', displayDate,                    '',
      'CENTER TIME:', center.meeting_time || ''
    ]);
    rows.push([]);
    rows.push(['S.NO', 'MEMBER NAME', 'MOBILE NUMBER', 'LOAN AMOUNT', 'EMI', 'PAID WEEK', 'RM SIGN', '', '', '', '']);

    center.members.forEach((m, idx) => {
      rows.push([idx + 1, m.name, m.mobile, m.loan_amount, m.emi_amount, m.installment_no || '', '', '', '', '', '']);
    });

    // Filler rows up to 10
    for (let i = center.members.length + 1; i <= 10; i++) {
      rows.push([i, '', '', '', '', '', '', '', '', '', '']);
    }

    rows.push(['TOTAL', '', '', '', '', '', '', '', '', '', '']);
    rows.push([]);
    rows.push(['TOTAL CASH :', '', '', 'BM SIGN:', '', '', 'CENTER LEADER SIGN:', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 26 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    ];

    const sheetName = center.name.substring(0, 31).replace(/[\[\]:*?/\\]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Denomination sheet
  const denomRows = [
    ['DENOMINATION SHEET', '', '', '', ''],
    [],
    ['S.NO', 'NOTE', 'COUNT', 'RUPEES', ''],
    [1, '500', '', '', ''], [2, '200', '', '', ''], [3, '100', '', '', ''],
    [4, '50', '', '', ''],  [5, '20', '', '', ''],  [6, '10', '', '', ''],
    [7, '20 COIN', '', '', ''], [8, '10 COIN', '', '', ''], [9, '5 COIN', '', '', ''],
    [10, 'COINS', '', '', ''],
    ['TOTAL', '', '', '', ''],
    [],
    ['CENTER LEADER SIGN:', '', '', '', ''],
  ];
  const denomWs = XLSX.utils.aoa_to_sheet(denomRows);
  denomWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  XLSX.utils.book_append_sheet(wb, denomWs, 'Denomination');

  XLSX.writeFile(wb, `Center_Collection_Sheet_${data.date}.xlsx`);
}

export function exportReceiptPDF(receipt: {
  receipt_no: string;
  amount: number;
  penalty_paid: number;
  payment_date: string;
  payment_mode: string;
  customer_name: string;
  mobile: string;
  loan_no: string;
  loan_amount: number;
  collected_by_name: string;
  center_name?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 130] });

  const navy = [15, 30, 68] as [number, number, number];
  const gold = [212, 175, 55] as [number, number, number];

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, 80, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SPS Group of Foundation', 40, 9, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Microfinance Payment Receipt', 40, 15, { align: 'center' });
  doc.text(`Receipt #: ${receipt.receipt_no}`, 40, 20, { align: 'center' });

  // Body
  doc.setTextColor(30, 30, 30);
  const left = 8;
  let y = 30;
  const lineH = 7;

  function row(label: string, value: string, bold = false) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(label, left, y);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(value, 72, y, { align: 'right' });
    y += lineH;
  }

  row('Customer', receipt.customer_name);
  row('Mobile', receipt.mobile);
  row('Loan No', receipt.loan_no);
  row('Date', format(new Date(receipt.payment_date), 'dd MMM yyyy'));
  row('Mode', receipt.payment_mode.toUpperCase());

  // Divider
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(left, y, 72, y);
  y += 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('Amount Paid', left, y);
  doc.text(`Rs. ${receipt.amount.toFixed(2)}`, 72, y, { align: 'right' });
  y += lineH;

  if (receipt.penalty_paid > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 0, 0);
    doc.text('Penalty', left, y);
    doc.text(`Rs. ${receipt.penalty_paid.toFixed(2)}`, 72, y, { align: 'right' });
    y += lineH;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(left, y, 72, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  row('Collected by', receipt.collected_by_name);
  if (receipt.center_name) row('Center', receipt.center_name);

  // Footer
  y += 2;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Thank you for your payment!', 40, y, { align: 'center' });
  y += 5;
  doc.text('This is a computer-generated receipt.', 40, y, { align: 'center' });

  doc.save(`Receipt_${receipt.receipt_no}.pdf`);
}
