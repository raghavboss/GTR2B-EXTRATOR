
export interface InvoiceRow {
  [key: string]: any;
}

export interface ExtractionResult {
  headers: string[];
  data: InvoiceRow[];
  markdown: string;
  fileName?: string; // Added to track source filename
  sheetName?: string; // Added to track source sheet name
}

export interface SavedReport extends ExtractionResult {
  id?: number;
  createdAt: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  VIEW_DATA = 'VIEW_DATA',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

// --- AUTH & RBAC TYPES ---

export type Permission = 
  | 'dashboard:view'
  | 'gstr2b:extract'
  | 'sale_register:extract'
  | 'uploader:use' // New unified uploader permission
  | 'reports:view'
  | 'reports:delete'
  | 'merge:access'
  | 'master_data:view'
  | 'master_data:edit' // For uploading/deleting files in master data
  | 'analytics:view'
  | 'settings:access'
  | 'users:manage'
  | 'rbac:manage'
  | 'branches:manage'
  | 'departments:manage'
  | 'payroll:access'
  | 'employees:view'   
  | 'employees:manage'
  | 'attendance:view'   // New
  | 'attendance:manage'
  | 'inventory:view'    // ERP
  | 'inventory:manage'  // ERP
  | 'accounting:view'   // ERP
  | 'accounting:manage' // ERP
  | 'petty_cash:view'   // New
  | 'petty_cash:manage' // New
  | 'audit:view';       // New Audit

export interface Branch {
  id: string; // Branch Code e.g., 'JPR01'
  name: string;
  location: string;
  gstin?: string;
  address?: string; 
  manager?: string; 
  contactNumber?: string; 
}

export interface Department {
  id: string; // Dept Code e.g., 'FIN', 'HR'
  name: string;
  description?: string;
}

export interface Role {
  id: string; // e.g., 'super_admin', 'branch_admin'
  name: string;
  description: string;
  permissions: Permission[];
}

export interface SalaryStructure {
  basic: number;
  hra: number;
  specialAllowance: number;
  pfDeduction: boolean; // If true, deduct 12% of Basic
  professionalTax: number; // Fixed monthly amount
  tds: number; // Estimated monthly tax deduction
}

export interface User {
  id?: number;
  email: string;
  passwordHash: string; // In real app, this is bcrypt hash. Here we simulate.
  name: string;
  roleId: string;
  branchIds: string[]; // Changed to array for multi-branch support
  departmentId?: string; // New field for Department link
  baseSalary?: number; // Legacy field, kept for compatibility
  salaryStructure?: SalaryStructure; // New detailed structure
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id?: number;
  userId: number; // Links to User.id
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO String
  checkOut?: string; // ISO String
  status: 'Present' | 'Absent' | 'Leave' | 'Half-Day';
  totalHours?: number;
}

export interface BusinessProfile {
  companyName: string;
  legalName?: string;
  gstin: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  website?: string;
  logoUrl?: string; // Base64 string for logo
}

// --- INVENTORY TYPES ---

export interface Godown {
  id: string;
  name: string;
  location: string;
  branchId?: string; // Link to Branch
}

export interface InventoryItem {
  id?: number;
  name: string;
  sku: string;
  hsn: string;
  unit: string; // e.g., 'PCS', 'KG', 'MTR'
  category: string;
  gstRate: number; // 5, 12, 18, 28
  purchasePrice: number;
  sellingPrice: number;
  minStockLevel: number; // For alerts
  description?: string;
  // Stock held in each godown
  stock: { [godownId: string]: number }; 
}

// --- ACCOUNTING TYPES ---

export interface Ledger {
  id?: number;
  code?: string; // Numeric Code e.g. "1001"
  name: string;
  alias?: string; // Tally field
  group: string; // "Under Group"
  
  // Mailing Details
  mailingName?: string;
  address?: string;
  state?: string;
  country?: string;
  pincode?: string;
  
  // Tax Details
  pan?: string;
  registrationType?: 'Regular' | 'Composition' | 'Consumer' | 'Unregistered';
  gstin?: string; // For B2B parties
  
  // Balances
  openingBalance: number;
  openingBalanceType?: 'Dr' | 'Cr';
  currentBalance: number;

  // Portal Access
  portalEmail?: string;
  portalPassword?: string;
}

export interface VoucherItem {
  itemId: number;
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
  gstRate: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface Voucher {
  id?: number;
  type: 'Sales' | 'Purchase' | 'Receipt' | 'Payment' | 'Journal' | 'Contra';
  date: string;
  referenceNo: string; // Invoice No
  partyLedgerId: number; // Customer/Vendor
  items: VoucherItem[];
  totalAmount: number;
  totalTax: number;
  narration?: string;
}

export interface PettyCashEntry {
  id?: number;
  date: string;
  type: 'Receipt' | 'Payment'; // Receipt = Money from Main Cashier, Payment = Expense
  category: string; // e.g., 'Refreshments', 'Stationery', 'Logistics'
  description: string;
  amount: number;
  voucherNo?: string;
  submittedBy?: string; // User who entered it
}

export interface PettyCashTemplate {
    id?: number;
    name: string;
    description: string;
    amount: number;
    category: string;
    type: 'Payment' | 'Receipt';
}

export interface AuditLog {
    id?: number;
    timestamp: string;
    userId: number | string; // Can be internal User ID or External ID
    userName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VIEW';
    module: string;
    description: string;
    metadata?: any; // For detailed changes
}
