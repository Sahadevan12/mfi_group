export interface LoanParams {
  amount: number;
  interestRate: number;
  interestType: 'flat' | 'reducing';
  duration: number;
  durationUnit: 'months' | 'weeks' | 'days';
  emiFrequency: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  processingFee?: number;
}

export interface EMIResult {
  emiAmount: number;
  totalInterest: number;
  totalPayable: number;
  totalInstallments: number;
  endDate: string;
  schedule: ScheduleEntry[];
}

export interface ScheduleEntry {
  installmentNo: number;
  dueDate: string;
  emiAmount: number;
  principal: number;
  interest: number;
  balance: number;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getNextDueDate(startDate: Date, installmentNo: number, frequency: string): Date {
  if (frequency === 'daily') return addDays(startDate, installmentNo);
  if (frequency === 'weekly') return addWeeks(startDate, installmentNo);
  return addMonths(startDate, installmentNo);
}

function getTotalInstallments(duration: number, durationUnit: string, emiFrequency: string): number {
  // Direct match: same unit as frequency — no conversion needed
  if (durationUnit === 'months' && emiFrequency === 'monthly') return duration;
  if (durationUnit === 'weeks'  && emiFrequency === 'weekly')  return duration;
  if (durationUnit === 'days'   && emiFrequency === 'daily')   return duration;

  // Convert duration → total days
  let totalDays = duration;
  if (durationUnit === 'months') totalDays = duration * 30;
  else if (durationUnit === 'weeks') totalDays = duration * 7;

  if (emiFrequency === 'daily')   return totalDays;
  if (emiFrequency === 'weekly')  return Math.round(totalDays / 7);
  return Math.round(totalDays / 30); // monthly
}

export function calculateLoan(params: LoanParams): EMIResult {
  const { amount, interestRate, interestType, duration, durationUnit, emiFrequency, startDate } = params;
  const start = new Date(startDate);
  const n = getTotalInstallments(duration, durationUnit, emiFrequency);

  let emiAmount: number;
  let totalInterest: number;
  let schedule: ScheduleEntry[] = [];

  const periodicRate = interestRate / 100 / (emiFrequency === 'monthly' ? 12 : emiFrequency === 'weekly' ? 52 : 365);

  if (interestType === 'flat') {
    totalInterest = amount * (interestRate / 100) * (duration / (durationUnit === 'months' ? 12 : durationUnit === 'weeks' ? 52 : 365));
    const totalPayableAmount = amount + totalInterest;
    emiAmount = Math.ceil(totalPayableAmount / n);
    const principalPerInstallment = amount / n;
    const interestPerInstallment = totalInterest / n;
    let balance = amount;

    for (let i = 1; i <= n; i++) {
      const dueDate = getNextDueDate(start, i, emiFrequency);
      const isLast = i === n;
      const actualEmi = isLast ? balance + interestPerInstallment : emiAmount;
      balance = isLast ? 0 : balance - principalPerInstallment;

      schedule.push({
        installmentNo: i,
        dueDate: formatDate(dueDate),
        emiAmount: parseFloat(actualEmi.toFixed(2)),
        principal: parseFloat(principalPerInstallment.toFixed(2)),
        interest: parseFloat(interestPerInstallment.toFixed(2)),
        balance: parseFloat(Math.max(0, balance).toFixed(2)),
      });
    }
  } else {
    // Reducing balance
    if (periodicRate === 0) {
      emiAmount = amount / n;
    } else {
      emiAmount = (amount * periodicRate * Math.pow(1 + periodicRate, n)) / (Math.pow(1 + periodicRate, n) - 1);
    }
    emiAmount = parseFloat(emiAmount.toFixed(2));

    let balance = amount;
    totalInterest = 0;

    for (let i = 1; i <= n; i++) {
      const dueDate = getNextDueDate(start, i, emiFrequency);
      const interestComponent = parseFloat((balance * periodicRate).toFixed(2));
      const principalComponent = parseFloat((emiAmount - interestComponent).toFixed(2));
      totalInterest += interestComponent;
      balance = parseFloat(Math.max(0, balance - principalComponent).toFixed(2));

      const isLast = i === n;
      schedule.push({
        installmentNo: i,
        dueDate: formatDate(dueDate),
        emiAmount: isLast ? parseFloat((principalComponent + interestComponent + balance).toFixed(2)) : emiAmount,
        principal: parseFloat(principalComponent.toFixed(2)),
        interest: parseFloat(interestComponent.toFixed(2)),
        balance: isLast ? 0 : balance,
      });
    }
  }

  const totalPayable = parseFloat((amount + totalInterest).toFixed(2));
  const endDate = schedule[schedule.length - 1]?.dueDate || startDate;

  return {
    emiAmount,
    totalInterest: parseFloat(totalInterest.toFixed(2)),
    totalPayable,
    totalInstallments: n,
    endDate,
    schedule,
  };
}

export function generateLoanNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `SPS${year}${month}${random}`;
}

export function generateReceiptNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  return `RCP${timestamp}`;
}
