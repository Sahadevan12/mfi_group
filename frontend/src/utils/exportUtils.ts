import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-ignore – xlsx-js-style adds cell-level styling on top of xlsx
import XS from 'xlsx-js-style';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════
// BRAND CONSTANTS
// ═══════════════════════════════════════════════════
const NAVY: [number, number, number]  = [15, 30, 68];
const GOLD: [number, number, number]  = [212, 175, 55];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_BG: [number, number, number] = [248, 250, 252];
const GRAY_BD: [number, number, number] = [226, 232, 240];
const GREEN:  [number, number, number] = [16, 185, 129];
const RED:    [number, number, number] = [220, 53, 69];
const ORANGE: [number, number, number] = [245, 158, 11];
const BLUE:   [number, number, number] = [59, 130, 246];

// Excel hex colours
const XL = {
  NAVY:    '0F1E44', NAVY2:   '1E3A5F',
  GOLD:    'D4AF37', WHITE:   'FFFFFF',
  GRAY_BG: 'F8FAFC', GRAY_BD: 'E2E8F0', GRAY_FT: 'E2E8F0',
  SECTION: 'EEF2FA',
  GREEN:   '10B981', RED:     'DC3545',
  ORANGE:  'F59E0B', BLUE:    '3B82F6',
};

const CO   = 'SPS GROUP OF FOUNDATION';
const ADDR = '28, Street Kallamozhi, Udangudi, Tuticorin';
const PH   = 'PH: 04639-243023  |  CELL: 9788130671';

const inr = (n: any) => `Rs.${Number(n || 0).toLocaleString('en-IN')}`;
const ts  = () => format(new Date(), 'dd MMM yyyy, hh:mm a');

// ═══════════════════════════════════════════════════
// PDF HELPERS (unchanged)
// ═══════════════════════════════════════════════════

function makePDF(landscape = true) {
  return new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
}

function pdfHdr(doc: jsPDF, title: string, period?: string): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.5, 'F');
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
    doc.setTextColor(100, 100, 100); doc.text(period, 14, 43); y = 43;
  }
  doc.setFontSize(7.5); doc.setTextColor(160, 160, 160);
  doc.text(`Generated: ${ts()}`, W - 14, 36, { align: 'right' });
  return y + 7;
}

function pdfBoxes(doc: jsPDF, items: Array<{ label: string; value: string; color?: [number,number,number] }>, y: number): number {
  const W = doc.internal.pageSize.getWidth(), M = 14, n = items.length;
  const bW = (W - M * 2 - (n - 1) * 3) / n, H = 15;
  items.forEach((item, i) => {
    const x = M + i * (bW + 3), c = item.color || NAVY;
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

function pdfTable(doc: jsPDF, head: string[], body: (string|number)[][], foot: (string|number)[][]|null, startY: number, colStyles?: Record<number, any>): number {
  autoTable(doc, {
    startY, head: [head], body, foot: foot || undefined,
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
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const pages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY); doc.rect(0, H - 8, W, 8, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7);
    doc.text('SPS Group of Foundation — Microfinance Management System — Confidential', W / 2, H - 3.5, { align: 'center' });
    doc.text(`Page ${p} of ${pages}`, W - 14, H - 3.5, { align: 'right' });
  }
}

function savePDF(doc: jsPDF, name: string) { pdfFooter(doc); doc.save(name); }

// ═══════════════════════════════════════════════════
// EXCEL STYLED BUILDER
// Mirrors PDF layout: navy header → summary boxes → section titles → tables
// ═══════════════════════════════════════════════════

// Thin border on all sides
const brd = (c = XL.GRAY_BD) => ({
  top: { style: 'thin', color: { rgb: c } }, bottom: { style: 'thin', color: { rgb: c } },
  left: { style: 'thin', color: { rgb: c } }, right: { style: 'thin', color: { rgb: c } },
});

// Cell factory
function xc(v: any, s: any): any {
  return { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s };
}

class XlsBuilder {
  private ws: Record<string, any> = {};
  private merges: any[] = [];
  private rowH: any[] = [];
  r = 0;
  ncols: number;

  constructor(ncols: number) { this.ncols = ncols; }

  private addr(r: number, c: number) { return XS.utils.encode_cell({ r, c }); }

  row(cells: any[], height?: number) {
    cells.forEach((c, i) => { if (c !== null) this.ws[this.addr(this.r, i)] = c; });
    if (height) this.rowH[this.r] = { hpt: height };
    this.r++; return this;
  }

  gap(n = 1) { this.r += n; return this; }

  mrg(r1: number, c1: number, r2: number, c2: number) {
    this.merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  fill(nc: number, s: any) { return Array(nc).fill(xc('', { fill: s.fill || {} })); }

  /* ── Company header (navy band → gold line → title → period) ── */
  hdr(title: string, period: string) {
    const nc = this.ncols;
    const navy = { patternType: 'solid', fgColor: { rgb: XL.NAVY } };
    const gold = { patternType: 'solid', fgColor: { rgb: XL.GOLD } };
    const w = (sz: number, bold = false) => ({ name: 'Arial', sz, bold, color: { rgb: XL.WHITE } });
    const ctr = { horizontal: 'center', vertical: 'center' };

    // Row 0 — Company name
    const r0 = this.r;
    this.row([xc(CO, { font: w(13, true), fill: navy, alignment: ctr }),
      ...Array(nc - 1).fill(xc('', { fill: navy }))], 22);
    this.mrg(r0, 0, r0, nc - 1);

    // Row 1 — Address + phone
    const r1 = this.r;
    this.row([xc(`${ADDR}  |  ${PH}`, { font: w(8), fill: navy, alignment: ctr }),
      ...Array(nc - 1).fill(xc('', { fill: navy }))], 13);
    this.mrg(r1, 0, r1, nc - 1);

    // Row 2 — Gold separator
    const r2 = this.r;
    this.row(Array(nc).fill(xc('', { fill: gold })), 4);
    this.mrg(r2, 0, r2, nc - 1);

    // Row 3 — Report title (left) + Generated (right)
    const r3 = this.r;
    this.row([
      xc(title, { font: { name: 'Arial', sz: 13, bold: true, color: { rgb: XL.NAVY } }, alignment: { horizontal: 'left', vertical: 'center' } }),
      ...Array(Math.max(nc - 2, 0)).fill(xc('', { font: { name: 'Arial', sz: 13 }, alignment: { horizontal: 'left', vertical: 'center' } })),
      xc(`Generated: ${ts()}`, { font: { name: 'Arial', sz: 8, color: { rgb: 'AAAAAA' } }, alignment: { horizontal: 'right', vertical: 'center' } }),
    ], 20);
    if (nc > 2) this.mrg(r3, 0, r3, nc - 2);

    // Row 4 — Period
    const r4 = this.r;
    this.row([xc(period, { font: { name: 'Arial', sz: 9, color: { rgb: '555555' } }, alignment: { horizontal: 'left', vertical: 'center' } }),
      ...Array(nc - 1).fill(xc('', { font: { name: 'Arial', sz: 9 } }))], 13);
    this.mrg(r4, 0, r4, nc - 1);

    this.gap();
    return this;
  }

  /* ── Summary boxes matching PDF colored stat boxes ── */
  summary(items: Array<{ label: string; value: string; color?: string }>) {
    const grayFill = { patternType: 'solid', fgColor: { rgb: XL.GRAY_BG } };
    // 2 items per row (label col + value col × 2), filling all ncols
    const pairW = Math.floor(this.ncols / Math.min(items.length, 4));
    const cells: any[] = [];

    items.forEach((item, i) => {
      const c = item.color || XL.NAVY;
      const start = i * pairW;
      const labelCell = xc(item.label, {
        font: { name: 'Arial', sz: 8, color: { rgb: '666666' } },
        fill: grayFill,
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { ...brd(), left: { style: 'medium', color: { rgb: c } } },
      });
      const valueCell = xc(item.value, {
        font: { name: 'Arial', sz: 11, bold: true, color: { rgb: c } },
        fill: grayFill,
        alignment: { horizontal: 'right', vertical: 'center' },
        border: brd(),
      });
      // fill pair into cells array
      while (cells.length < start) cells.push(xc('', { fill: grayFill, border: brd() }));
      cells[start] = labelCell;
      // value spans rest of pair
      for (let j = start + 1; j < start + pairW; j++) {
        cells[j] = j === start + pairW - 1 ? valueCell : xc('', { fill: grayFill, border: brd() });
      }
      // merge label and value cells
      this.mrg(this.r, start, this.r, start + pairW - 2);
      this.mrg(this.r, start + pairW - 1, this.r, start + pairW - 1);
    });

    while (cells.length < this.ncols) cells.push(xc('', { fill: grayFill, border: brd() }));
    this.row(cells, 20);
    this.gap();
    return this;
  }

  /* ── Section title with navy left accent ── */
  section(text: string) {
    const r = this.r;
    const secFill = { patternType: 'solid', fgColor: { rgb: XL.SECTION } };
    this.row([
      xc(`  ${text}`, {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: XL.NAVY } },
        fill: secFill,
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { left: { style: 'medium', color: { rgb: XL.NAVY } }, bottom: { style: 'thin', color: { rgb: XL.GRAY_BD } } },
      }),
      ...Array(this.ncols - 1).fill(xc('', { fill: secFill, border: { bottom: { style: 'thin', color: { rgb: XL.GRAY_BD } } } })),
    ], 16);
    this.mrg(r, 0, r, this.ncols - 1);
    return this;
  }

  /* ── Data table matching PDF table style ── */
  table(headers: string[], rows: any[][], totals: any[] | null, rightCols: number[] = []) {
    const navyFill = { patternType: 'solid', fgColor: { rgb: XL.NAVY } };
    const thStyle = {
      font: { name: 'Arial', sz: 9, bold: true, color: { rgb: XL.WHITE } },
      fill: navyFill,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: brd(XL.NAVY2),
    };

    // Header row
    this.row(headers.map(h => xc(h, thStyle)), 18);

    const whiteFill = { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } };
    const altRowFill = { patternType: 'solid', fgColor: { rgb: XL.GRAY_BG } };

    // Data rows (alternating white / light-gray)
    rows.forEach((row, ri) => {
      const fill = ri % 2 === 1 ? altRowFill : whiteFill;
      const cells = row.map((v, ci) => {
        const isNum = typeof v === 'number';
        const align = rightCols.includes(ci) || isNum ? 'right' : 'left';
        return { v: v ?? '', t: (isNum ? 'n' : 's') as any,
          s: { font: { name: 'Arial', sz: 8.5, color: { rgb: '222222' } }, fill, alignment: { horizontal: align, vertical: 'center' }, border: brd() } };
      });
      while (cells.length < this.ncols) cells.push(xc('', { fill: whiteFill, border: brd() }));
      this.row(cells, 15);
    });

    // Totals row
    if (totals) {
      const totFill = { patternType: 'solid', fgColor: { rgb: XL.GRAY_FT } };
      const totBorder = { ...brd(), top: { style: 'medium', color: { rgb: XL.NAVY } }, bottom: { style: 'medium', color: { rgb: XL.NAVY } } };
      const tCells = totals.map((v, ci) => {
        const isNum = typeof v === 'number';
        const align = rightCols.includes(ci) || isNum ? 'right' : 'left';
        return { v: v ?? '', t: (isNum ? 'n' : 's') as any,
          s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: XL.NAVY } }, fill: totFill, alignment: { horizontal: align, vertical: 'center' }, border: totBorder } };
      });
      while (tCells.length < this.ncols) tCells.push(xc('', { fill: totFill, border: totBorder }));
      this.row(tCells, 16);
    }

    this.gap();
    return this;
  }

  /* ── Build final worksheet ── */
  build(colWidths: number[]): any {
    this.ws['!ref'] = XS.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.r + 1, c: this.ncols - 1 } });
    this.ws['!merges'] = this.merges;
    this.ws['!cols'] = colWidths.map(w => ({ wch: w }));
    this.ws['!rows'] = this.rowH;
    return this.ws;
  }
}

function xlsBook() { return XS.utils.book_new(); }
function xlsAdd(wb: any, ws: any, name: string) {
  XS.utils.book_append_sheet(wb, ws, name.substring(0, 31).replace(/[[\]:*?/\\]/g, '_'));
}
function xlsSave(wb: any, f: string) { XS.writeFile(wb, f); }

// ═══════════════════════════════════════════════════
// 1. DAILY COLLECTION
// ═══════════════════════════════════════════════════
export function exportDailyPDF(data: any, date: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Daily Collection Report', `Date: ${date}`);
  const s = data.summary || {};
  y = pdfBoxes(doc, [
    { label: 'Total Collected',   value: inr(s.total_amount),  color: GREEN  },
    { label: 'Transactions',      value: String(s.total_transactions || 0)   },
    { label: 'Customers Paid',    value: String(s.customers_paid || 0)       },
    { label: 'Loans Paid',        value: String(s.loans_paid || 0)           },
    { label: 'Penalty Collected', value: inr(s.total_penalty), color: ORANGE },
  ], y);
  if (data.byAgent?.length) {
    y = pdfSection(doc, 'Collection by Agent', y);
    y = pdfTable(doc, ['Agent Name', 'Transactions', 'Amount (Rs.)'],
      data.byAgent.map((a: any) => [a.agent_name, a.transactions, inr(a.amount)]),
      [['TOTAL', data.byAgent.reduce((s: number, a: any) => s + Number(a.transactions), 0), inr(s.total_amount)]], y, { 2: { halign: 'right' } });
  }
  y = pdfSection(doc, 'Transaction Details', y);
  pdfTable(doc,
    ['Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Amount (Rs.)'],
    (data.details || []).map((d: any) => [d.receipt_no, d.customer_name, d.mobile, d.loan_no, d.center_name||'—', d.group_name||'—', d.payment_mode, inr(d.amount)]),
    [['', 'TOTAL', '', '', '', '', '', inr(s.total_amount)]], y, { 7: { halign: 'right' } });
  savePDF(doc, `Daily_Collection_${date}.pdf`);
}

export function exportDailyExcel(data: any, date: string) {
  const s = data.summary || {};
  const nc = 9;
  const b = new XlsBuilder(nc);
  b.hdr('Daily Collection Report', `Date: ${date}`)
   .summary([
     { label: 'Total Collected',   value: inr(s.total_amount),            color: XL.GREEN  },
     { label: 'Transactions',      value: String(s.total_transactions||0)                  },
     { label: 'Customers Paid',    value: String(s.customers_paid||0)                      },
     { label: 'Penalty Collected', value: inr(s.total_penalty),           color: XL.ORANGE },
   ]);
  if (data.byAgent?.length) {
    b.section('Collection by Agent')
     .table(['Agent Name', 'Transactions', 'Amount (Rs.)'],
       data.byAgent.map((a: any) => [a.agent_name, a.transactions, inr(a.amount)]),
       ['TOTAL', data.byAgent.reduce((s: number, a: any) => s + Number(a.transactions), 0), inr(s.total_amount)],
       [2]);
  }
  b.section('Transaction Details')
   .table(
     ['Receipt No', 'Customer Name', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Collected By', 'Amount (Rs.)'],
     (data.details||[]).map((d: any) => [d.receipt_no, d.customer_name, d.mobile, d.loan_no, d.center_name||'', d.group_name||'', d.payment_mode, d.collected_by_name, inr(d.amount)]),
     ['', 'TOTAL', '', '', '', '', '', '', inr(s.total_amount)], [8]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([22, 26, 14, 18, 22, 20, 14, 20, 16]), 'Daily Collection');
  xlsSave(wb, `Daily_Collection_${date}.xlsx`);
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
    { label: 'Transactions',      value: String(s.total_transactions||0)     },
    { label: 'Customers Paid',    value: String(s.customers_paid||0)         },
    { label: 'Penalty Collected', value: inr(s.total_penalty), color: ORANGE },
  ], y);
  y = pdfSection(doc, 'Day-wise Trend', y);
  y = pdfTable(doc, ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily||[]).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
    [['TOTAL', s.total_transactions, inr(s.total_amount)]], y, { 2: { halign: 'right' } });
  y = pdfSection(doc, 'Center-wise Breakup', y);
  y = pdfTable(doc, ['Center', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter||[]).map((c: any) => [c.center_name||'—', c.transactions, inr(c.amount)]),
    [['TOTAL', (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))]], y, { 2: { halign: 'right' } });
  y = pdfSection(doc, 'Group-wise Breakup', y);
  y = pdfTable(doc, ['Group', 'Center', 'Transactions', 'Amount (Rs.)'],
    (data.byGroup||[]).map((g: any) => [g.group_name||'—', g.center_name||'—', g.transactions, inr(g.amount)]),
    [['TOTAL', '', (data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.transactions), 0),
      inr((data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.amount), 0))]], y, { 3: { halign: 'right' } });
  y = pdfSection(doc, 'All Transactions', y);
  pdfTable(doc,
    ['Date', 'Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'By', 'Amount (Rs.)'],
    (data.details||[]).map((d: any) => [d.payment_date, d.receipt_no, d.customer_name, d.mobile, d.loan_no, d.center_name||'—', d.group_name||'—', d.payment_mode, d.collected_by_name, inr(d.amount)]),
    [['', '', 'TOTAL', '', '', '', '', '', '', inr(s.total_amount)]], y, { 9: { halign: 'right' } });
  savePDF(doc, `Weekly_Collection_${data.from}_${data.to}.pdf`);
}

export function exportWeeklyExcel(data: any) {
  const s = data.summary || {};
  const period = `Period: ${data.from} to ${data.to}`;
  const nc = 10;
  const b = new XlsBuilder(nc);
  b.hdr('Weekly Collection Report', period)
   .summary([
     { label: 'Total Collected',   value: inr(s.total_amount),  color: XL.GREEN  },
     { label: 'Transactions',      value: String(s.total_transactions||0)         },
     { label: 'Customers Paid',    value: String(s.customers_paid||0)             },
     { label: 'Penalty Collected', value: inr(s.total_penalty), color: XL.ORANGE },
   ])
   .section('Day-wise Trend')
   .table(['Date', 'Transactions', 'Amount (Rs.)'],
     (data.daily||[]).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
     ['TOTAL', s.total_transactions, inr(s.total_amount)], [2])
   .section('Center-wise Breakup')
   .table(['Center', 'Transactions', 'Amount (Rs.)'],
     (data.byCenter||[]).map((c: any) => [c.center_name||'—', c.transactions, inr(c.amount)]),
     ['TOTAL', (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
       inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))], [2])
   .section('Group-wise Breakup')
   .table(['Group', 'Center', 'Transactions', 'Amount (Rs.)'],
     (data.byGroup||[]).map((g: any) => [g.group_name||'—', g.center_name||'—', g.transactions, inr(g.amount)]),
     ['TOTAL', '', (data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.transactions), 0),
       inr((data.byGroup||[]).reduce((s: number, g: any) => s + Number(g.amount), 0))], [3])
   .section('All Transactions')
   .table(
     ['Date', 'Receipt No', 'Customer', 'Mobile', 'Loan No', 'Center', 'Group', 'Mode', 'Collected By', 'Amount (Rs.)'],
     (data.details||[]).map((d: any) => [d.payment_date, d.receipt_no, d.customer_name, d.mobile, d.loan_no, d.center_name||'', d.group_name||'', d.payment_mode, d.collected_by_name, inr(d.amount)]),
     ['', '', 'TOTAL', '', '', '', '', '', '', inr(s.total_amount)], [9]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([14, 22, 24, 14, 18, 20, 20, 14, 20, 16]), 'Weekly Collection');
  xlsSave(wb, `Weekly_Collection_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 3. MONTHLY COLLECTION
// ═══════════════════════════════════════════════════
export function exportMonthlyPDF(data: any) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Monthly Collection Report', `Month: ${data.month}`);
  const s = data.summary || {};
  y = pdfBoxes(doc, [
    { label: 'Total Collected',  value: inr(s.total_amount),       color: GREEN },
    { label: 'Transactions',     value: String(s.transactions||0)              },
    { label: 'Unique Customers', value: String(s.unique_customers||0)          },
  ], y);
  y = pdfSection(doc, 'Day-wise Collection', y);
  y = pdfTable(doc, ['Date', 'Transactions', 'Amount (Rs.)'],
    (data.daily||[]).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
    [['TOTAL', s.transactions, inr(s.total_amount)]], y, { 2: { halign: 'right' } });
  y = pdfSection(doc, 'Center-wise Collection', y);
  pdfTable(doc, ['Center', 'Transactions', 'Amount (Rs.)'],
    (data.byCenter||[]).map((c: any) => [c.center_name||'—', c.transactions, inr(c.amount)]),
    [['TOTAL', (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
      inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))]], y, { 2: { halign: 'right' } });
  savePDF(doc, `Monthly_Collection_${data.month}.pdf`);
}

export function exportMonthlyExcel(data: any) {
  const s = data.summary || {};
  const b = new XlsBuilder(6);
  b.hdr('Monthly Collection Report', `Month: ${data.month}`)
   .summary([
     { label: 'Total Collected',  value: inr(s.total_amount),       color: XL.GREEN },
     { label: 'Transactions',     value: String(s.transactions||0)                  },
     { label: 'Unique Customers', value: String(s.unique_customers||0)              },
   ])
   .section('Day-wise Collection')
   .table(['Date', 'Transactions', 'Amount (Rs.)'],
     (data.daily||[]).map((d: any) => [d.payment_date, d.transactions, inr(d.amount)]),
     ['TOTAL', s.transactions, inr(s.total_amount)], [2])
   .section('Center-wise Collection')
   .table(['Center', 'Transactions', 'Amount (Rs.)'],
     (data.byCenter||[]).map((c: any) => [c.center_name||'—', c.transactions, inr(c.amount)]),
     ['TOTAL', (data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.transactions), 0),
       inr((data.byCenter||[]).reduce((s: number, c: any) => s + Number(c.amount), 0))], [2]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([18, 14, 20, 14, 14, 14]), 'Monthly Collection');
  xlsSave(wb, `Monthly_Collection_${data.month}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 4. PENDING DUES
// ═══════════════════════════════════════════════════
export function exportPendingPDF(data: any) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Pending Dues Report', `As of: ${format(new Date(), 'dd MMM yyyy')}`);
  y = pdfBoxes(doc, [
    { label: 'Total Pending Amount', value: inr(data.totalPending), color: RED    },
    { label: 'Loans Affected',       value: String(data.count||0),  color: ORANGE },
  ], y);
  pdfTable(doc,
    ['Customer', 'Mobile', 'Loan No', 'Frequency', 'Center', 'Group', 'Earliest Due', 'Pending EMIs', 'Days Overdue', 'Pending Amount (Rs.)'],
    (data.dues||[]).map((d: any) => [d.customer_name, d.mobile, d.loan_no, d.emi_frequency||'—', d.center_name||'—', d.group_name||'—', d.earliest_due||'—', d.pending_installments, d.max_days_overdue > 0 ? `${d.max_days_overdue} days` : '0', inr(d.pending_amount)]),
    [['', '', '', '', '', '', '', '', 'TOTAL', inr(data.totalPending)]], y, { 9: { halign: 'right' }, 8: { halign: 'right' } });
  savePDF(doc, `Pending_Dues_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportPendingExcel(data: any) {
  const today = format(new Date(), 'dd MMM yyyy');
  const b = new XlsBuilder(10);
  b.hdr('Pending Dues Report', `As of: ${today}`)
   .summary([
     { label: 'Total Pending Amount', value: inr(data.totalPending), color: XL.RED    },
     { label: 'Loans Affected',       value: String(data.count||0),  color: XL.ORANGE },
   ])
   .section('Pending Dues Details')
   .table(
     ['Customer', 'Mobile', 'Loan No', 'EMI Freq', 'Center', 'Group', 'Earliest Due', 'Pending EMIs', 'Days Overdue', 'Pending Amount'],
     (data.dues||[]).map((d: any) => [d.customer_name, d.mobile, d.loan_no, d.emi_frequency||'', d.center_name||'', d.group_name||'', d.earliest_due||'', d.pending_installments, d.max_days_overdue, inr(d.pending_amount)]),
     ['', '', '', '', '', '', '', '', 'TOTAL', inr(data.totalPending)], [8, 9]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([24, 14, 18, 12, 20, 20, 16, 14, 14, 20]), 'Pending Dues');
  xlsSave(wb, `Pending_Dues_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 5. DEFAULTERS
// ═══════════════════════════════════════════════════
export function exportDefaultersPDF(rows: any[]) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Defaulters Report', `Loans overdue 30+ days — As of: ${format(new Date(), 'dd MMM yyyy')}`);
  const totalOutstanding = rows.reduce((s, d) => s + Number(d.outstanding||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Defaulters',  value: String(rows.length),   color: RED    },
    { label: 'Total Outstanding', value: inr(totalOutstanding), color: RED    },
    { label: 'Avg Days Overdue',  value: rows.length ? `${Math.round(rows.reduce((s, d) => s + Number(d.days_overdue||0), 0) / rows.length)} days` : '—', color: ORANGE },
  ], y);
  pdfTable(doc,
    ['Customer', 'Mobile', 'Loan No', 'Loan Amt (Rs.)', 'Total Paid (Rs.)', 'Outstanding (Rs.)', 'Overdue Since', 'Days Overdue', 'EMIs Overdue', 'Center', 'Group'],
    rows.map((d: any) => [d.name, d.mobile, d.loan_no, inr(d.amount), inr(d.total_paid), inr(d.outstanding), d.overdue_since||'—', `${d.days_overdue||0} days`, d.overdue_installments||0, d.center_name||'—', d.group_name||'—']),
    [['', '', '', '', 'TOTAL OUTSTANDING', inr(totalOutstanding), '', '', '', '', '']], y,
    { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } });
  savePDF(doc, `Defaulters_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportDefaultersExcel(rows: any[]) {
  const today = format(new Date(), 'dd MMM yyyy');
  const totalOutstanding = rows.reduce((s, d) => s + Number(d.outstanding||0), 0);
  const nc = 11;
  const b = new XlsBuilder(nc);
  b.hdr('Defaulters Report', `As of: ${today}`)
   .summary([
     { label: 'Total Defaulters',  value: String(rows.length),   color: XL.RED    },
     { label: 'Total Outstanding', value: inr(totalOutstanding), color: XL.RED    },
     { label: 'Avg Days Overdue',  value: rows.length ? `${Math.round(rows.reduce((s, d) => s + Number(d.days_overdue||0), 0) / rows.length)} days` : '—', color: XL.ORANGE },
   ])
   .section('Defaulters List')
   .table(
     ['Customer', 'Mobile', 'Address', 'Loan No', 'Loan Amt', 'Total Paid', 'Outstanding', 'Overdue Since', 'Days Overdue', 'EMIs Overdue', 'Center'],
     rows.map((d: any) => [d.name, d.mobile, d.address||'', d.loan_no, inr(d.amount), inr(d.total_paid), inr(d.outstanding||0), d.overdue_since||'', d.days_overdue||0, d.overdue_installments||0, d.center_name||'']),
     ['', '', '', '', '', '', inr(totalOutstanding), '', '', '', ''], [8, 9]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([24, 14, 26, 18, 16, 16, 16, 14, 14, 14, 20]), 'Defaulters');
  xlsSave(wb, `Defaulters_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 6. CENTER-WISE
// ═══════════════════════════════════════════════════
export function exportCenterWisePDF(rows: any[], from: string, to: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Center-wise Report', `Period: ${from}  to  ${to}`);
  const totalCol = rows.reduce((s, c) => s + Number(c.collected||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Centers',      value: String(rows.length)              },
    { label: 'Total Customers',    value: String(rows.reduce((s, c) => s + Number(c.customers||0), 0)) },
    { label: 'Total Collected',    value: inr(totalCol),      color: GREEN  },
    { label: 'Total Active Loans', value: String(rows.reduce((s, c) => s + Number(c.active_loans||0), 0)) },
  ], y);
  pdfTable(doc,
    ['Center Name', 'Area', 'Customers', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((c: any) => [c.name, c.area||'—', c.customers, c.active_loans, inr(c.collected), inr(c.pending_amount)]),
    [['TOTAL', '', rows.reduce((s, c) => s + Number(c.customers||0), 0), rows.reduce((s, c) => s + Number(c.active_loans||0), 0), inr(totalCol), inr(rows.reduce((s, c) => s + Number(c.pending_amount||0), 0))]], y,
    { 4: { halign: 'right' }, 5: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  savePDF(doc, `Center_Wise_${from}_${to}.pdf`);
}

export function exportCenterWiseExcel(rows: any[], from: string, to: string) {
  const totalCol = rows.reduce((s, c) => s + Number(c.collected||0), 0);
  const b = new XlsBuilder(6);
  b.hdr('Center-wise Report', `Period: ${from} to ${to}`)
   .summary([
     { label: 'Total Centers',   value: String(rows.length)                                       },
     { label: 'Total Customers', value: String(rows.reduce((s, c) => s + Number(c.customers||0), 0)) },
     { label: 'Total Collected', value: inr(totalCol),                       color: XL.GREEN      },
     { label: 'Active Loans',    value: String(rows.reduce((s, c) => s + Number(c.active_loans||0), 0)) },
   ])
   .section('Center-wise Breakdown')
   .table(
     ['Center Name', 'Area', 'Customers', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
     rows.map((c: any) => [c.name, c.area||'', c.customers, c.active_loans, inr(c.collected), inr(c.pending_amount||0)]),
     ['TOTAL', '', rows.reduce((s, c) => s + Number(c.customers||0), 0), rows.reduce((s, c) => s + Number(c.active_loans||0), 0), inr(totalCol), inr(rows.reduce((s, c) => s + Number(c.pending_amount||0), 0))],
     [2, 3, 4, 5]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([28, 22, 14, 14, 20, 22]), 'Center-wise');
  xlsSave(wb, `Center_Wise_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 7. GROUP-WISE
// ═══════════════════════════════════════════════════
export function exportGroupWisePDF(rows: any[], from: string, to: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, 'Group-wise Report', `Period: ${from}  to  ${to}`);
  const totalCol = rows.reduce((s, g) => s + Number(g.collected||0), 0);
  y = pdfBoxes(doc, [
    { label: 'Total Groups',   value: String(rows.length)               },
    { label: 'Total Members',  value: String(rows.reduce((s, g) => s + Number(g.members||0), 0)) },
    { label: 'Total Collected', value: inr(totalCol),    color: GREEN  },
    { label: 'Total Pending',  value: inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0)), color: ORANGE },
  ], y);
  pdfTable(doc,
    ['Group Name', 'Center', 'Members', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
    rows.map((g: any) => [g.group_name, g.center_name||'—', g.members, g.active_loans, inr(g.collected), inr(g.pending_amount)]),
    [['TOTAL', '', rows.reduce((s, g) => s + Number(g.members||0), 0), rows.reduce((s, g) => s + Number(g.active_loans||0), 0), inr(totalCol), inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0))]], y,
    { 4: { halign: 'right' }, 5: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  savePDF(doc, `Group_Wise_${from}_${to}.pdf`);
}

export function exportGroupWiseExcel(rows: any[], from: string, to: string) {
  const totalCol = rows.reduce((s, g) => s + Number(g.collected||0), 0);
  const b = new XlsBuilder(6);
  b.hdr('Group-wise Report', `Period: ${from} to ${to}`)
   .summary([
     { label: 'Total Groups',   value: String(rows.length)                                          },
     { label: 'Total Members',  value: String(rows.reduce((s, g) => s + Number(g.members||0), 0))   },
     { label: 'Total Collected', value: inr(totalCol),                        color: XL.GREEN       },
     { label: 'Total Pending',  value: inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0)), color: XL.ORANGE },
   ])
   .section('Group-wise Breakdown')
   .table(
     ['Group Name', 'Center', 'Members', 'Active Loans', 'Collected (Rs.)', 'Pending Amount (Rs.)'],
     rows.map((g: any) => [g.group_name, g.center_name||'', g.members, g.active_loans, inr(g.collected), inr(g.pending_amount||0)]),
     ['TOTAL', '', rows.reduce((s, g) => s + Number(g.members||0), 0), rows.reduce((s, g) => s + Number(g.active_loans||0), 0), inr(totalCol), inr(rows.reduce((s, g) => s + Number(g.pending_amount||0), 0))],
     [2, 3, 4, 5]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([28, 24, 14, 14, 20, 22]), 'Group-wise');
  xlsSave(wb, `Group_Wise_${from}_${to}.xlsx`);
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
    { label: 'Total Collected',   value: inr(totalAmt),  color: GREEN },
    { label: 'Total Collections', value: String(agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0)) },
    { label: 'Unique Customers',  value: String(agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0)) },
  ], y);
  y = pdfSection(doc, 'Agent Performance Summary', y);
  pdfTable(doc,
    ['Agent Name', 'Phone', 'Total Collections', 'Unique Customers', 'Working Days', 'Total Amount (Rs.)'],
    agents.map((a: any) => [a.name, a.phone||'—', a.total_collections, a.unique_customers, a.working_days, inr(a.total_amount)]),
    [['TOTAL', '', agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0), agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0), '—', inr(totalAmt)]], y, { 5: { halign: 'right' } });
  savePDF(doc, `Agent_Wise_${data.from}_${data.to}.pdf`);
}

export function exportAgentWiseExcel(data: any) {
  const agents = data.agents || [];
  const totalAmt = agents.reduce((s: number, a: any) => s + Number(a.total_amount||0), 0);
  const nc = 6;
  const b = new XlsBuilder(nc);
  b.hdr('Agent-wise Collection Report', `Period: ${data.from} to ${data.to}`)
   .summary([
     { label: 'Active Agents',     value: String(agents.filter((a: any) => Number(a.total_amount) > 0).length) },
     { label: 'Total Collected',   value: inr(totalAmt),  color: XL.GREEN },
     { label: 'Total Collections', value: String(agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0)) },
     { label: 'Unique Customers',  value: String(agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0)) },
   ])
   .section('Agent Performance')
   .table(
     ['Agent Name', 'Phone', 'Total Collections', 'Unique Customers', 'Working Days', 'Total Amount (Rs.)'],
     agents.map((a: any) => [a.name, a.phone||'', a.total_collections, a.unique_customers, a.working_days, inr(a.total_amount)]),
     ['TOTAL', '', agents.reduce((s: number, a: any) => s + Number(a.total_collections||0), 0), agents.reduce((s: number, a: any) => s + Number(a.unique_customers||0), 0), '', inr(totalAmt)],
     [2, 3, 4, 5]);
  if (data.dailyTrend?.length) {
    const agentNames = agents.map((a: any) => a.name);
    const grouped: Record<string, any> = {};
    data.dailyTrend.forEach((d: any) => {
      if (!grouped[d.payment_date]) grouped[d.payment_date] = { date: d.payment_date };
      grouped[d.payment_date][d.agent_name] = inr(d.amount);
    });
    b.section('Daily Trend by Agent')
     .table(
       ['Date', ...agentNames],
       Object.values(grouped).map((row: any) => [row.date, ...agentNames.map((n: string) => row[n] || '—')]),
       null);
  }
  const wb = xlsBook();
  xlsAdd(wb, b.build([28, 16, 18, 18, 14, 20]), 'Agent-wise');
  xlsSave(wb, `Agent_Wise_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 9. PROFIT & LOSS
// ═══════════════════════════════════════════════════
export function exportPLPDF(data: any) {
  const doc = makePDF(false);
  let y = pdfHdr(doc, 'Profit & Loss Statement', `Period: ${data.from}  to  ${data.to}`);
  const inc = data.income || {}, exp = data.expenses || {};
  y = pdfBoxes(doc, [
    { label: 'Gross Income',   value: inr(inc.gross_income),  color: GREEN },
    { label: 'Total Expenses', value: inr(exp.total),         color: RED   },
    { label: 'Net Profit',     value: inr(data.net_profit),   color: data.net_profit >= 0 ? GREEN : RED },
  ], y);
  y = pdfSection(doc, 'Income Breakdown', y);
  y = pdfTable(doc, ['Income Category', 'Amount (Rs.)'],
    [['Total Collections', inr(inc.total_collected)], ['Interest Income', inr(inc.interest_income)], ['Penalty Income', inr(inc.penalty_income)], ['Processing Fees', inr(inc.processing_fees)]],
    [['GROSS INCOME', inr(inc.gross_income)]], y, { 1: { halign: 'right' } });
  y = pdfSection(doc, 'Expense Breakdown', y);
  y = pdfTable(doc, ['Expense Category', 'Amount (Rs.)'],
    (exp.breakdown||[]).map((e: any) => [e.category.replace(/_/g,' ').toUpperCase(), inr(e.amount)]),
    [['TOTAL EXPENSES', inr(exp.total)]], y, { 1: { halign: 'right' } });
  if (data.monthly?.length) {
    y = pdfSection(doc, 'Monthly Trend', y);
    pdfTable(doc, ['Month', 'Collections (Rs.)'], data.monthly.map((m: any) => [m.month, inr(m.collections)]), null, y, { 1: { halign: 'right' } });
  }
  savePDF(doc, `Profit_Loss_${data.from}_${data.to}.pdf`);
}

export function exportPLExcel(data: any) {
  const inc = data.income || {}, exp = data.expenses || {};
  const b = new XlsBuilder(4);
  b.hdr('Profit & Loss Statement', `Period: ${data.from} to ${data.to}`)
   .summary([
     { label: 'Gross Income',   value: inr(inc.gross_income),  color: XL.GREEN },
     { label: 'Total Expenses', value: inr(exp.total),         color: XL.RED   },
     { label: 'Net Profit',     value: inr(data.net_profit),   color: data.net_profit >= 0 ? XL.GREEN : XL.RED },
   ])
   .section('Income Breakdown')
   .table(['Income Category', 'Amount (Rs.)'],
     [['Total Collections', inr(inc.total_collected)], ['Interest Income', inr(inc.interest_income)], ['Penalty Income', inr(inc.penalty_income)], ['Processing Fees', inr(inc.processing_fees)]],
     ['GROSS INCOME', inr(inc.gross_income)], [1])
   .section('Expense Breakdown')
   .table(['Expense Category', 'Amount (Rs.)'],
     (exp.breakdown||[]).map((e: any) => [e.category.replace(/_/g,' ').toUpperCase(), inr(e.amount)]),
     ['TOTAL EXPENSES', inr(exp.total)], [1]);
  if (data.monthly?.length) {
    b.section('Monthly Trend')
     .table(['Month', 'Collections (Rs.)'], data.monthly.map((m: any) => [m.month, inr(m.collections)]), null, [1]);
  }
  const wb = xlsBook();
  xlsAdd(wb, b.build([36, 22, 14, 14]), 'Profit & Loss');
  xlsSave(wb, `Profit_Loss_${data.from}_${data.to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// 10. CASH BOOK
// ═══════════════════════════════════════════════════
export function exportCashbookPDF(data: any, from: string, to: string) {
  const doc = makePDF(false);
  let y = pdfHdr(doc, 'Cash Book', `Period: ${from}  to  ${to}`);
  y = pdfBoxes(doc, [
    { label: 'Collections (In)',    value: inr(data.totalIncome),    color: GREEN  },
    { label: 'Loans Disbursed (Out)', value: inr(data.totalDisbursed), color: BLUE   },
    { label: 'Expenses (Out)',      value: inr(data.totalExpenses),  color: RED    },
    { label: 'Net Balance',         value: inr(data.netProfit),      color: data.netProfit >= 0 ? GREEN : RED },
  ], y);
  y = pdfSection(doc, 'Collections (Cash In)', y);
  y = pdfTable(doc, ['Date', 'Type', 'Amount (Rs.)'],
    (data.income||[]).map((i: any) => [i.date, 'Collection', inr(i.amount)]),
    [['', 'TOTAL INCOME', inr(data.totalIncome)]], y, { 2: { halign: 'right' } });
  y = pdfSection(doc, 'Loan Disbursements (Cash Out)', y);
  y = pdfTable(doc, ['Date', 'No. of Loans', 'Loan Numbers', 'Amount (Rs.)'],
    (data.disbursements||[]).map((d: any) => [d.date, `${d.count} loan(s)`, d.loan_nos||'', inr(d.amount)]),
    [['', '', 'TOTAL DISBURSED', inr(data.totalDisbursed)]], y, { 3: { halign: 'right' } });
  y = pdfSection(doc, 'Expenses (Cash Out)', y);
  pdfTable(doc, ['Date', 'Category', 'Amount (Rs.)'],
    (data.expenses||[]).map((e: any) => [e.date, e.type, inr(e.amount)]),
    [['', 'TOTAL EXPENSES', inr(data.totalExpenses)]], y, { 2: { halign: 'right' } });
  savePDF(doc, `Cash_Book_${from}_${to}.pdf`);
}

export function exportCashbookExcel(data: any, from: string, to: string) {
  const b = new XlsBuilder(4);
  b.hdr('Cash Book', `Period: ${from} to ${to}`)
   .summary([
     { label: 'Collections (In)',       value: inr(data.totalIncome),    color: XL.GREEN  },
     { label: 'Loans Disbursed (Out)',  value: inr(data.totalDisbursed), color: XL.BLUE   },
     { label: 'Expenses (Out)',         value: inr(data.totalExpenses),  color: XL.RED    },
     { label: 'Net Balance',            value: inr(data.netProfit),      color: data.netProfit >= 0 ? XL.GREEN : XL.RED },
   ])
   .section('Collections (Cash In)')
   .table(['Date', 'Type', 'Amount (Rs.)', ''],
     (data.income||[]).map((i: any) => [i.date, 'Collection', inr(i.amount), '']),
     ['', 'TOTAL INCOME', inr(data.totalIncome), ''], [2])
   .section('Loan Disbursements (Cash Out)')
   .table(['Date', 'No. of Loans', 'Loan Numbers', 'Amount (Rs.)'],
     (data.disbursements||[]).map((d: any) => [d.date, `${d.count} loan(s)`, d.loan_nos||'', inr(d.amount)]),
     ['', '', 'TOTAL DISBURSED', inr(data.totalDisbursed)], [3])
   .section('Expenses (Cash Out)')
   .table(['Date', 'Category', 'Amount (Rs.)', ''],
     (data.expenses||[]).map((e: any) => [e.date, e.type, inr(e.amount), '']),
     ['', 'TOTAL EXPENSES', inr(data.totalExpenses), ''], [2]);
  const wb = xlsBook();
  xlsAdd(wb, b.build([16, 24, 20, 20]), 'Cash Book');
  xlsSave(wb, `Cash_Book_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════
// CENTER COLLECTION SHEET (unchanged)
// ═══════════════════════════════════════════════════
// ─── SPS Center Collection Sheet (matches uploaded format exactly) ───────────
// Layout: Member list (cols A-G) | Denomination sheet (cols I-M) side-by-side
export function exportCollectionSheet(opts: {
  periodLabel: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  displayDate: string;          // e.g. "26/5/2026"
  dateRange?: string;           // e.g. "26/5/2026 - 01/6/2026"
  center: { name: string; area?: string; meeting_day?: string; meeting_time?: string };
  members: Array<{ name: string; mobile: string; loan_amount: number; emi_amount: number; installment_no?: number }>;
}) {
  const { periodLabel, displayDate, dateRange, center, members } = opts;

  // ── style helpers ────────────────────────────────
  const nv = '0F1E44';   // navy
  const gd = 'D4AF37';   // gold
  const wh = 'FFFFFF';
  const gy = 'F0F4F8';   // alt row
  const ft = 'E2E8F0';   // footer/total

  const navyFill = { patternType: 'solid', fgColor: { rgb: nv } };
  const whiteFill = { patternType: 'solid', fgColor: { rgb: wh } };
  const altFill   = { patternType: 'solid', fgColor: { rgb: gy } };
  const totFill   = { patternType: 'solid', fgColor: { rgb: ft } };
  const goldFill  = { patternType: 'solid', fgColor: { rgb: 'FFF3CD' } };

  const thinBrd = { style: 'thin', color: { rgb: 'CCCCCC' } };
  const brd  = { top: thinBrd, bottom: thinBrd, left: thinBrd, right: thinBrd };
  const nbrd = { top: { style: 'thin', color: { rgb: nv } }, bottom: { style: 'thin', color: { rgb: nv } }, left: { style: 'thin', color: { rgb: nv } }, right: { style: 'thin', color: { rgb: nv } } };

  const cell = (v: any, extra: any = {}) => ({
    v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: extra,
  });

  const navyHdr = (v: string, align: 'center'|'left'='center') => cell(v, {
    font: { name: 'Arial', sz: 9, bold: true, color: { rgb: wh } },
    fill: navyFill, alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: nbrd,
  });
  const dataCell = (v: any, fillStyle: any, align: 'left'|'right'|'center' = 'left') => ({
    v: v ?? '', t: typeof v === 'number' ? 'n' : 's',
    s: { font: { name: 'Arial', sz: 9, color: { rgb: '1A1A1A' } }, fill: fillStyle,
         alignment: { horizontal: align, vertical: 'center' }, border: brd },
  });
  const emptyCell = (fillStyle: any = whiteFill) => cell('', { fill: fillStyle, border: brd });

  const DENOM = [
    { note: '500*' }, { note: '200*' }, { note: '100*' }, { note: '50*' },
    { note: '20*' },  { note: '10*' },  { note: '20 COIN*' }, { note: '10 COIN*' },
    { note: '5 COIN*' }, { note: 'COINS' },
  ];

  const wb = XS.utils.book_new();
  const aoa: any[][] = [];

  // Row 0 (row 1): Title
  aoa.push([
    cell('SPS GROUP FOUNDATION', {
      font: { name: 'Arial', sz: 16, bold: true, color: { rgb: wh } },
      fill: navyFill, alignment: { horizontal: 'center', vertical: 'center' },
    }),
    ...Array(12).fill(cell('', { fill: navyFill })),
  ]);

  // Row 1 (row 2): Day Order | Address
  aoa.push([
    cell('DAY ORDER :', { font: { name: 'Arial', sz: 9, bold: true }, fill: goldFill, border: brd }),
    cell(center.meeting_day || '', { font: { name: 'Arial', sz: 9, bold: true }, fill: goldFill, border: brd }),
    cell(`28, Street, Kallamozhi, Udangudi, Tuticorin`, { font: { name: 'Arial', sz: 8 }, fill: goldFill, alignment: { horizontal: 'center' }, border: brd }),
    ...Array(7).fill(cell('', { fill: goldFill, border: brd })),
    cell('', { fill: goldFill }),
    cell('', { fill: goldFill }),
  ]);

  // Row 2 (row 3): Phone | Date
  aoa.push([
    cell('', { fill: goldFill }),
    cell('', { fill: goldFill }),
    cell('PH: 04639-243023, CELL: 9788130671', { font: { name: 'Arial', sz: 8 }, fill: goldFill, alignment: { horizontal: 'center' }, border: brd }),
    ...Array(7).fill(cell('', { fill: goldFill, border: brd })),
    cell('DATE :', { font: { name: 'Arial', sz: 9, bold: true }, fill: goldFill, alignment: { horizontal: 'right' }, border: brd }),
    cell(dateRange || displayDate, { font: { name: 'Arial', sz: 9, bold: true }, fill: goldFill, border: brd }),
  ]);

  // Row 3 (row 4): Center Name | CENTER COLLECTION SHEET | Center Time
  aoa.push([
    cell('CENTER NAME :', { font: { name: 'Arial', sz: 9, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, border: brd }),
    cell(center.name, { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: nv } }, fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, border: brd }),
    cell('CENTER COLLECTION SHEET', { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: nv } }, fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: brd }),
    ...Array(7).fill(cell('', { fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, border: brd })),
    cell('CENTER TIME :', { font: { name: 'Arial', sz: 9, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, alignment: { horizontal: 'right' }, border: brd }),
    cell(center.meeting_time || '', { font: { name: 'Arial', sz: 9, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } }, border: brd }),
  ]);

  // Row 4 (row 5): Period label | DENOMINATION label
  aoa.push([
    cell('', {}), cell('', {}),
    cell(periodLabel, { font: { name: 'Arial', sz: 10, bold: true, color: { rgb: nv } }, alignment: { horizontal: 'center' } }),
    cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}),
    cell('DENOMINATION', { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: nv } }, alignment: { horizontal: 'center' } }),
    cell('', {}), cell('', {}), cell('', {}), cell('', {}),
  ]);

  // Row 5 (row 6): Column Headers
  aoa.push([
    navyHdr('S NO'), navyHdr('MEMBER NAME'), navyHdr('MOBILE NUMBER'),
    navyHdr('LOAN AMOUNT'), navyHdr('EMI'), navyHdr('PAID WEEK'), navyHdr('RM SIGN'),
    cell('', { fill: whiteFill }),  // gap
    navyHdr('S NO'), navyHdr('NOTE'), navyHdr('COUNT'), navyHdr('RUPEES'), navyHdr('CENTER LEADER SIGN'),
  ]);

  // Data rows (member + denomination side-by-side, 10 rows)
  for (let i = 0; i < 10; i++) {
    const m = members[i];
    const denom = DENOM[i];
    const fill = i % 2 === 0 ? whiteFill : altFill;
    aoa.push([
      dataCell(i + 1, fill, 'center'),
      dataCell(m?.name || '', fill),
      dataCell(m ? String(m.mobile) : '', fill),
      dataCell(m ? m.loan_amount : '', fill, 'right'),
      dataCell(m ? m.emi_amount : '', fill, 'right'),
      dataCell(m?.installment_no || '', fill, 'center'),
      emptyCell(fill),
      cell('', { fill: whiteFill }),  // gap column
      dataCell(i + 1, fill, 'center'),
      dataCell(denom.note, fill),
      emptyCell(fill),
      emptyCell(fill),
      emptyCell(fill),
    ]);
  }

  // TOTAL row
  const totalEmi = members.reduce((s, m) => s + (Number(m?.emi_amount) || 0), 0);
  aoa.push([
    cell('TOTAL', { font: { name: 'Arial', sz: 9, bold: true }, fill: totFill, border: brd }),
    emptyCell(totFill), emptyCell(totFill), emptyCell(totFill),
    cell(totalEmi || '', { font: { name: 'Arial', sz: 9, bold: true }, fill: totFill, alignment: { horizontal: 'right' }, border: brd }),
    emptyCell(totFill), emptyCell(totFill),
    cell('', { fill: whiteFill }),
    cell('TOTAL', { font: { name: 'Arial', sz: 9, bold: true }, fill: totFill, border: brd }),
    emptyCell(totFill), emptyCell(totFill), emptyCell(totFill), emptyCell(totFill),
  ]);

  aoa.push(Array(13).fill(cell('', {})));

  // TOTAL CASH row
  aoa.push([
    cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}),
    cell('TOTAL CASH :', { font: { name: 'Arial', sz: 10, bold: true, color: { rgb: nv } }, alignment: { horizontal: 'right' } }),
    cell('', {}),
    cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}),
  ]);

  aoa.push(Array(13).fill(cell('', {})));

  // BM SIGN row
  aoa.push([
    cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}),
    cell('BM SIGN :', { font: { name: 'Arial', sz: 10, bold: true, color: { rgb: nv } }, alignment: { horizontal: 'right' } }),
    cell('', {}),
    cell('', {}), cell('', {}), cell('', {}), cell('', {}), cell('', {}),
  ]);

  const ws = XS.utils.aoa_to_sheet(aoa);

  // Column widths: A-G (member) | H (gap) | I-M (denom)
  ws['!cols'] = [
    { wch: 5 }, { wch: 24 }, { wch: 14 }, { wch: 13 }, { wch: 9 }, { wch: 10 }, { wch: 10 },
    { wch: 1.5 },
    { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 18 },
  ];

  ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 18 }, { hpt: 20 }, { hpt: 16 }, { hpt: 18 }];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },          // Title
    { s: { r: 1, c: 2 }, e: { r: 1, c: 9 } },            // Address
    { s: { r: 2, c: 2 }, e: { r: 2, c: 9 } },            // Phone
    { s: { r: 3, c: 2 }, e: { r: 3, c: 9 } },            // CENTER COLLECTION SHEET
    { s: { r: 4, c: 2 }, e: { r: 4, c: 6 } },            // Period label
    { s: { r: 4, c: 8 }, e: { r: 4, c: 12 } },           // DENOMINATION
    { s: { r: 5 + 10 + 1, c: 6 }, e: { r: 5 + 10 + 1, c: 12 } }, // TOTAL CASH label merge
  ];

  const safeName = center.name.substring(0, 31).replace(/[[\]:*?/\\]/g, '_');
  XS.utils.book_append_sheet(wb, ws, safeName);

  const filename = `Collection_Sheet_${center.name.replace(/\s+/g, '_')}_${displayDate.replace(/\//g, '-')}.xlsx`;
  XS.writeFile(wb, filename);
}

export function exportCenterCollectionSheet(data: {
  date: string;
  centers: Array<{
    name: string; area?: string; meeting_day?: string; meeting_time?: string;
    members: Array<{ name: string; mobile: string; loan_amount: number; emi_amount: number; installment_no?: number; paid_today?: number }>;
  }>;
}) {
  const wb = XS.utils.book_new();
  const [y, m, d] = data.date.split('-');
  const displayDate = `${d}/${m}/${y}`;
  for (const center of data.centers) {
    const rows: any[][] = [];
    rows.push([CO,'','','','','','','','','','']);
    rows.push(['WEEKLY CENTER COLLECTION SHEET','','','','','','','','','','']);
    rows.push([`${ADDR} | ${PH}`,'','','','','','','','','','']);
    rows.push([]);
    rows.push(['DAY ORDER:', center.meeting_day||'','','CENTER NAME:',center.name,'','DATE:',displayDate,'','CENTER TIME:',center.meeting_time||'']);
    rows.push([]);
    rows.push(['S.NO','MEMBER NAME','MOBILE NUMBER','LOAN AMOUNT','EMI','PAID WEEK','RM SIGN','','','','']);
    center.members.forEach((m, idx) => rows.push([idx+1, m.name, m.mobile, m.loan_amount, m.emi_amount, m.installment_no||'','','','','','']));
    for (let i = center.members.length + 1; i <= 10; i++) rows.push([i,'','','','','','','','','','']);
    rows.push(['TOTAL','','','','','','','','','','']);
    rows.push([]);
    rows.push(['TOTAL CASH :','','','BM SIGN:','','','CENTER LEADER SIGN:','','','','']);
    const ws = XS.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:6},{wch:26},{wch:14},{wch:14},{wch:10},{wch:12},{wch:12},{wch:8},{wch:8},{wch:8},{wch:8}];
    ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:10}},{s:{r:1,c:0},e:{r:1,c:10}},{s:{r:2,c:0},e:{r:2,c:10}}];
    XS.utils.book_append_sheet(wb, ws, center.name.substring(0,31).replace(/[[\]:*?/\\]/g,'_'));
  }
  const dRows = [['DENOMINATION SHEET','','','',''],[]
    ,['S.NO','NOTE','COUNT','RUPEES','']
    ,[1,'500','','',''],[2,'200','','',''],[3,'100','','',''],[4,'50','','','']
    ,[5,'20','','',''],[6,'10','','',''],[7,'20 COIN','','',''],[8,'10 COIN','','','']
    ,[9,'5 COIN','','',''],[10,'COINS','','','']
    ,['TOTAL','','','',''],[]
    ,['CENTER LEADER SIGN:','','','','']];
  const dWs = XS.utils.aoa_to_sheet(dRows);
  dWs['!merges'] = [{s:{r:0,c:0},e:{r:0,c:4}}];
  XS.utils.book_append_sheet(wb, dWs, 'Denomination');
  XS.writeFile(wb, `Center_Collection_Sheet_${data.date}.xlsx`);
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
  const navy: [number,number,number] = [15,30,68], gold: [number,number,number] = [212,175,55];
  doc.setFillColor(...navy); doc.rect(0,0,80,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('SPS Group of Foundation',40,9,{align:'center'});
  doc.setFontSize(7); doc.setFont('helvetica','normal');
  doc.text('Microfinance Payment Receipt',40,15,{align:'center'});
  doc.text(`Receipt #: ${receipt.receipt_no}`,40,20,{align:'center'});
  doc.setTextColor(30,30,30);
  const left=8; let y=30; const lH=7;
  function row(label: string, value: string, bold=false) {
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
    doc.text(label,left,y);
    doc.setFont('helvetica',bold?'bold':'normal'); doc.setTextColor(30,30,30);
    doc.text(value,72,y,{align:'right'}); y+=lH;
  }
  row('Customer',receipt.customer_name); row('Mobile',receipt.mobile); row('Loan No',receipt.loan_no);
  row('Date',format(new Date(receipt.payment_date),'dd MMM yyyy')); row('Mode',receipt.payment_mode.toUpperCase());
  doc.setDrawColor(...gold); doc.setLineWidth(0.5); doc.line(left,y,72,y); y+=4;
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...navy);
  doc.text('Amount Paid',left,y); doc.text(`Rs. ${receipt.amount.toFixed(2)}`,72,y,{align:'right'}); y+=lH;
  if(receipt.penalty_paid>0){
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(180,0,0);
    doc.text('Penalty',left,y); doc.text(`Rs. ${receipt.penalty_paid.toFixed(2)}`,72,y,{align:'right'}); y+=lH;
  }
  doc.setDrawColor(200,200,200); doc.line(left,y,72,y); y+=4;
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(120,120,120);
  row('Collected by',receipt.collected_by_name);
  if(receipt.center_name) row('Center',receipt.center_name);
  y+=2; doc.setFontSize(7); doc.setTextColor(150,150,150);
  doc.text('Thank you for your payment!',40,y,{align:'center'}); y+=5;
  doc.text('This is a computer-generated receipt.',40,y,{align:'center'});
  doc.save(`Receipt_${receipt.receipt_no}.pdf`);
}

// Legacy shims (Reports.tsx still imports these for fallback paths)
export function exportPDF(title: string, columns: {header:string;dataKey:string}[], rows: Record<string,any>[], filename?: string) {
  const doc = makePDF(true);
  let y = pdfHdr(doc, title);
  pdfTable(doc, columns.map(c=>c.header), rows.map(row=>columns.map(c=>row[c.dataKey]??'')), null, y);
  savePDF(doc, filename||`${title.replace(/\s+/g,'_')}_${format(new Date(),'yyyyMMdd')}.pdf`);
}
export function exportExcel(sheetName: string, columns: {header:string;dataKey:string}[], rows: Record<string,any>[], filename?: string) {
  const nc = columns.length;
  const b = new XlsBuilder(nc);
  b.hdr(sheetName, ts())
   .table(columns.map(c=>c.header), rows.map(row=>columns.map(c=>row[c.dataKey]??'')), null);
  const wb = xlsBook();
  xlsAdd(wb, b.build(columns.map(()=>18)), sheetName);
  xlsSave(wb, filename||`${sheetName.replace(/\s+/g,'_')}_${format(new Date(),'yyyyMMdd')}.xlsx`);
}
