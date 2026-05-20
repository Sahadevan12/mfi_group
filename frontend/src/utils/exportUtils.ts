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
