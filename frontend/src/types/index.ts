export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer';
  phone?: string;
  is_active?: number;
}

export interface Center {
  id: string;
  name: string;
  meeting_day?: string;
  meeting_time?: string;
  area?: string;
  location?: string;
  staff_id?: string;
  staff_name?: string;
  customer_count?: number;
  group_count?: number;
  is_active?: number;
}

export interface Group {
  id: string;
  name: string;
  center_id: string;
  center_name?: string;
  description?: string;
  leader_id?: string;
  leader_name?: string;
  leader_mobile?: string;
  customer_count?: number;
  customers?: Customer[];
  is_active?: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  alt_mobile?: string;
  photo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  aadhaar?: string;
  pan?: string;
  dob?: string;
  gender?: string;
  nominee_name?: string;
  nominee_relation?: string;
  nominee_mobile?: string;
  guarantor_name?: string;
  guarantor_mobile?: string;
  guarantor_address?: string;
  center_id?: string;
  center_name?: string;
  group_id?: string;
  group_name?: string;
  user_id?: string;
  total_loans?: number;
  active_loans?: number;
  is_active?: number;
  created_at?: string;
  loans?: Loan[];
  collections?: Collection[];
}

export interface Loan {
  id: string;
  loan_no: string;
  customer_id: string;
  customer_name?: string;
  mobile?: string;
  center_name?: string;
  group_name?: string;
  amount: number;
  interest_rate: number;
  interest_type: 'flat' | 'reducing';
  duration: number;
  duration_unit: string;
  emi_frequency: 'daily' | 'weekly' | 'monthly';
  emi_amount: number;
  total_payable: number;
  total_interest: number;
  processing_fee?: number;
  penalty_per_day?: number;
  disbursement_date?: string;
  start_date: string;
  end_date?: string;
  status: 'pending' | 'active' | 'closed' | 'rejected' | 'written_off';
  total_paid?: number;
  total_installments: number;
  paid_installments?: number;
  notes?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  created_at?: string;
  schedule?: LoanSchedule[];
  collections?: Collection[];
}

export interface LoanSchedule {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  emi_amount: number;
  principal: number;
  interest: number;
  balance: number;
  paid_amount: number;
  paid_date?: string;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
}

export interface Collection {
  id: string;
  receipt_no: string;
  loan_id: string;
  loan_no?: string;
  customer_id: string;
  customer_name?: string;
  mobile?: string;
  center_name?: string;
  group_name?: string;
  schedule_id?: string;
  collected_by: string;
  collected_by_name?: string;
  amount: number;
  penalty_paid?: number;
  payment_date: string;
  payment_type: 'regular' | 'partial' | 'advance' | 'penalty';
  payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  notes?: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  expense_date: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeLoans: number;
  pendingLoans: number;
  totalCollection: number;
  monthCollection: number;
  totalCollectionAll: number;
  overdueLoans: number;
  pendingAmount: number;
  totalCenters: number;
  totalStaff: number;
  totalPrincipal: number;
  totalOutstanding: number;
  totalInterest: number;
  totalDisbursed: number;
}

export interface EMICalculation {
  emiAmount: number;
  totalInterest: number;
  totalPayable: number;
  totalInstallments: number;
  endDate: string;
  schedule: {
    installmentNo: number;
    dueDate: string;
    emiAmount: number;
    principal: number;
    interest: number;
    balance: number;
  }[];
}
