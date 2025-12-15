
import { openDB, DBSchema } from 'idb';
import { SavedReport, User, Role, Branch, Department, AttendanceRecord, BusinessProfile, InventoryItem, Godown, Ledger, Voucher, PettyCashEntry, PettyCashTemplate, AuditLog } from '../types';

interface GstrDB extends DBSchema {
  reports: {
    key: number;
    value: SavedReport;
  };
  users: {
    key: number;
    value: User;
    indexes: { 'by-email': string };
  };
  roles: {
    key: string;
    value: Role;
  };
  branches: {
    key: string;
    value: Branch;
  };
  departments: {
    key: string;
    value: Department;
  };
  attendance: {
    key: number;
    value: AttendanceRecord;
    indexes: { 'by-user-date': [number, string], 'by-date': string };
  };
  settings: {
    key: string;
    value: any; 
  };
  // ERP Stores
  items: {
    key: number;
    value: InventoryItem;
    indexes: { 'by-sku': string };
  };
  godowns: {
    key: string;
    value: Godown;
  };
  ledgers: {
    key: number;
    value: Ledger;
  };
  vouchers: {
    key: number;
    value: Voucher;
  };
  petty_cash: {
    key: number;
    value: PettyCashEntry;
    indexes: { 'by-date': string };
  };
  petty_cash_templates: {
    key: number;
    value: PettyCashTemplate;
  };
  audit_logs: {
    key: number;
    value: AuditLog;
    indexes: { 'by-timestamp': string, 'by-module': string };
  };
}

const DB_NAME = 'gstr2b_analytics_db';
const DB_VERSION = 12; // Incremented for Audit Trail

const DEFAULT_ROLES: Role[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to all modules and settings.',
    permissions: [
      'dashboard:view', 'gstr2b:extract', 'sale_register:extract', 'uploader:use', 'reports:view', 'reports:delete', 
      'merge:access', 'master_data:view', 'master_data:edit', 'analytics:view', 
      'settings:access', 'users:manage', 'rbac:manage', 'branches:manage', 'departments:manage',
      'payroll:access', 'employees:view', 'employees:manage', 'attendance:view', 'attendance:manage',
      'inventory:view', 'inventory:manage', 'accounting:view', 'accounting:manage',
      'petty_cash:view', 'petty_cash:manage', 'audit:view'
    ]
  },
  {
    id: 'branch_admin',
    name: 'Branch Admin',
    description: 'Can manage extraction, inventory and view reports for their branch.',
    permissions: [
      'dashboard:view', 'gstr2b:extract', 'sale_register:extract', 'uploader:use', 'reports:view', 'reports:delete',
      'master_data:view', 'master_data:edit', 'employees:view', 'attendance:view', 'attendance:manage',
      'inventory:view', 'inventory:manage', 'accounting:view', 'petty_cash:view', 'petty_cash:manage'
    ]
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Read-only access to reports and data. Can manage accounting.',
    permissions: [
      'dashboard:view', 'reports:view', 'master_data:view', 'analytics:view', 'attendance:view',
      'inventory:view', 'accounting:view', 'accounting:manage', 'petty_cash:view', 'petty_cash:manage'
    ]
  },
  {
    id: 'corporate_viewer',
    name: 'Corporate Viewer',
    description: 'View access to all analytics and merged reports.',
    permissions: [
      'dashboard:view', 'reports:view', 'merge:access', 'master_data:view', 'analytics:view', 'audit:view'
    ]
  },
  {
    id: 'hr_manager',
    name: 'HR Manager',
    description: 'Access to payroll modules and employee dashboard.',
    permissions: ['dashboard:view', 'payroll:access', 'employees:view', 'employees:manage', 'attendance:view', 'attendance:manage']
  },
  {
    id: 'store_manager',
    name: 'Store Manager',
    description: 'Access to inventory and stock management.',
    permissions: ['dashboard:view', 'inventory:view', 'inventory:manage']
  }
];

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'hq', name: 'Corporate HQ', location: 'New Delhi', gstin: '07AAACC1234A1Z5' },
  { id: 'jaipur', name: 'Jaipur Branch', location: 'Jaipur, Rajasthan', gstin: '08AABBB5555B1Z1' },
  { id: 'jodhpur', name: 'Jodhpur Branch', location: 'Jodhpur, Rajasthan', gstin: '08AABBB5555B1Z2' }
];

const DEFAULT_GODOWNS: Godown[] = [
    { id: 'MAIN_JP', name: 'Main Godown (Jaipur)', location: 'Jaipur', branchId: 'jaipur' },
    { id: 'MAIN_JD', name: 'Main Godown (Jodhpur)', location: 'Jodhpur', branchId: 'jodhpur' },
    { id: 'SHOP_JP', name: 'Shop Floor (Jaipur)', location: 'Jaipur', branchId: 'jaipur' },
];

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'FIN', name: 'Finance & Accounts', description: 'Manages financial records, audits, and taxation.' },
  { id: 'HR', name: 'Human Resources', description: 'Employee lifecycle, payroll, and compliance.' },
  { id: 'IT', name: 'Information Technology', description: 'System administration and technical support.' },
  { id: 'OPS', name: 'Operations', description: 'Day-to-day business operations and logistics.' }
];

const DEFAULT_ADMIN: User = {
  email: 'admin@corp.com',
  passwordHash: 'admin123', // In production, use bcrypt!
  name: 'System Administrator',
  roleId: 'super_admin',
  branchIds: ['hq'], // Updated to array
  departmentId: 'IT',
  baseSalary: 150000,
  salaryStructure: {
    basic: 75000,
    hra: 37500,
    specialAllowance: 37500,
    pfDeduction: true,
    professionalTax: 200,
    tds: 15000
  },
  isActive: true,
  createdAt: new Date().toISOString()
};

const DEFAULT_TEMPLATES: PettyCashTemplate[] = [
    { name: 'Daily Tea/Coffee', description: 'Morning tea for staff (20 cups)', amount: 200, category: 'Refreshments', type: 'Payment' },
    { name: 'Water Jugs', description: 'Drinking water refill (5 jugs)', amount: 150, category: 'Refreshments', type: 'Payment' },
    { name: 'Local Courier', description: 'Document courier within city', amount: 80, category: 'Courier', type: 'Payment' },
];

export const initDB = async () => {
  return openDB<GstrDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 1 Stores
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
      }

      // Version 2 Stores (Auth)
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('by-email', 'email', { unique: true });
        userStore.add(DEFAULT_ADMIN);
      }

      if (!db.objectStoreNames.contains('roles')) {
        const roleStore = db.createObjectStore('roles', { keyPath: 'id' });
        DEFAULT_ROLES.forEach(role => roleStore.add(role));
      }

      // Version 3 Stores (Branches)
      if (!db.objectStoreNames.contains('branches')) {
        const branchStore = db.createObjectStore('branches', { keyPath: 'id' });
        DEFAULT_BRANCHES.forEach(branch => branchStore.add(branch));
      }

      // Version 4 Stores (Departments)
      if (!db.objectStoreNames.contains('departments')) {
        const deptStore = db.createObjectStore('departments', { keyPath: 'id' });
        DEFAULT_DEPARTMENTS.forEach(dept => deptStore.add(dept));
      }

      // Version 6 Stores (Attendance)
      if (!db.objectStoreNames.contains('attendance')) {
        const attStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
        attStore.createIndex('by-user-date', ['userId', 'date'], { unique: true });
        attStore.createIndex('by-date', 'date');
      }

      // Version 7 Stores (Settings/Business Profile)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // Version 8 Stores (ERP - Inventory & Accounting)
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        itemStore.createIndex('by-sku', 'sku', { unique: true });
      }
      if (!db.objectStoreNames.contains('godowns')) {
        const gStore = db.createObjectStore('godowns', { keyPath: 'id' });
        DEFAULT_GODOWNS.forEach(g => gStore.add(g));
      }
      if (!db.objectStoreNames.contains('ledgers')) {
        db.createObjectStore('ledgers', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('vouchers')) {
        db.createObjectStore('vouchers', { keyPath: 'id', autoIncrement: true });
      }

      // Version 9 Store (Petty Cash)
      if (!db.objectStoreNames.contains('petty_cash')) {
        const pcStore = db.createObjectStore('petty_cash', { keyPath: 'id', autoIncrement: true });
        pcStore.createIndex('by-date', 'date');
      }

      // Version 10 Store (Petty Cash Templates)
      if (!db.objectStoreNames.contains('petty_cash_templates')) {
        const tplStore = db.createObjectStore('petty_cash_templates', { keyPath: 'id', autoIncrement: true });
        DEFAULT_TEMPLATES.forEach(t => tplStore.add(t));
      }

      // Version 12 Store (Audit Trail)
      if (!db.objectStoreNames.contains('audit_logs')) {
        const auditStore = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
        auditStore.createIndex('by-timestamp', 'timestamp');
        auditStore.createIndex('by-module', 'module');
      }
    },
  });
};

// --- Audit API ---

export const logAudit = async (entry: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const db = await initDB();
    return db.add('audit_logs', {
        ...entry,
        timestamp: new Date().toISOString()
    });
};

export const getAllAuditLogs = async (): Promise<AuditLog[]> => {
    const db = await initDB();
    return db.getAllFromIndex('audit_logs', 'by-timestamp');
};

// --- Reports API ---
export const saveReport = async (report: Omit<SavedReport, 'id'>): Promise<number> => {
  const db = await initDB();
  return db.add('reports', report as SavedReport);
};

export const updateReport = async (report: SavedReport): Promise<number> => {
  const db = await initDB();
  if (!report.id) throw new Error("Report ID is required for update");
  return db.put('reports', report);
};

export const getAllReports = async (): Promise<SavedReport[]> => {
  const db = await initDB();
  return db.getAll('reports');
};

export const deleteReport = async (id: number): Promise<void> => {
  const db = await initDB();
  return db.delete('reports', id);
};

// --- Auth API ---

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
  const db = await initDB();
  return db.getFromIndex('users', 'by-email', email);
};

export const getAllUsers = async (): Promise<User[]> => {
  const db = await initDB();
  return db.getAll('users');
};

export const saveUser = async (user: User): Promise<number> => {
  const db = await initDB();
  return db.put('users', user);
};

export const deleteUser = async (id: number): Promise<void> => {
  const db = await initDB();
  return db.delete('users', id);
};

export const getAllRoles = async (): Promise<Role[]> => {
  const db = await initDB();
  return db.getAll('roles');
};

export const saveRole = async (role: Role): Promise<string> => {
  const db = await initDB();
  return db.put('roles', role);
};

export const deleteRole = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('roles', id);
};

// --- Branch API ---

export const getAllBranches = async (): Promise<Branch[]> => {
  const db = await initDB();
  return db.getAll('branches');
};

export const saveBranch = async (branch: Branch): Promise<string> => {
  const db = await initDB();
  return db.put('branches', branch);
};

export const deleteBranch = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('branches', id);
};

// --- Department API ---

export const getAllDepartments = async (): Promise<Department[]> => {
  const db = await initDB();
  return db.getAll('departments');
};

export const saveDepartment = async (dept: Department): Promise<string> => {
  const db = await initDB();
  return db.put('departments', dept);
};

export const deleteDepartment = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('departments', id);
};

// --- Attendance API ---

export const getAttendanceByUserAndDate = async (userId: number, date: string): Promise<AttendanceRecord | undefined> => {
  const db = await initDB();
  return db.getFromIndex('attendance', 'by-user-date', [userId, date]);
};

export const getAttendanceByDate = async (date: string): Promise<AttendanceRecord[]> => {
  const db = await initDB();
  return db.getAllFromIndex('attendance', 'by-date', date);
};

export const getAllAttendance = async (): Promise<AttendanceRecord[]> => {
  const db = await initDB();
  return db.getAll('attendance');
};

export const saveAttendance = async (record: AttendanceRecord): Promise<number> => {
  const db = await initDB();
  return db.put('attendance', record);
};

// --- Settings/Business Profile API ---

export const getBusinessProfile = async (): Promise<BusinessProfile | undefined> => {
  const db = await initDB();
  return db.get('settings', 'business_profile');
};

export const saveBusinessProfile = async (profile: BusinessProfile): Promise<string> => {
  const db = await initDB();
  return db.put('settings', profile, 'business_profile');
};

// --- ERP: Inventory API ---

export const getAllItems = async (): Promise<InventoryItem[]> => {
  const db = await initDB();
  return db.getAll('items');
};

export const saveItem = async (item: InventoryItem): Promise<number> => {
  const db = await initDB();
  return db.put('items', item);
};

export const deleteItem = async (id: number): Promise<void> => {
  const db = await initDB();
  return db.delete('items', id);
};

export const getAllGodowns = async (): Promise<Godown[]> => {
  const db = await initDB();
  return db.getAll('godowns');
};

// --- ERP: Accounting API ---

export const getAllLedgers = async (): Promise<Ledger[]> => {
  const db = await initDB();
  return db.getAll('ledgers');
};

export const saveLedger = async (ledger: Ledger): Promise<number> => {
  const db = await initDB();
  return db.put('ledgers', ledger);
};

export const getAllVouchers = async (): Promise<Voucher[]> => {
  const db = await initDB();
  return db.getAll('vouchers');
};

export const saveVoucher = async (voucher: Voucher): Promise<number> => {
  const db = await initDB();
  return db.put('vouchers', voucher);
};

// --- Petty Cash API ---

export const getAllPettyCash = async (): Promise<PettyCashEntry[]> => {
  const db = await initDB();
  return db.getAll('petty_cash');
};

export const savePettyCash = async (entry: PettyCashEntry): Promise<number> => {
  const db = await initDB();
  return db.put('petty_cash', entry);
};

export const deletePettyCash = async (id: number): Promise<void> => {
  const db = await initDB();
  return db.delete('petty_cash', id);
};

// --- Petty Cash Templates API ---

export const getAllPettyCashTemplates = async (): Promise<PettyCashTemplate[]> => {
    const db = await initDB();
    return db.getAll('petty_cash_templates');
};

export const savePettyCashTemplate = async (template: PettyCashTemplate): Promise<number> => {
    const db = await initDB();
    return db.put('petty_cash_templates', template);
};

export const deletePettyCashTemplate = async (id: number): Promise<void> => {
    const db = await initDB();
    return db.delete('petty_cash_templates', id);
};

// --- Mock Data Seeding (Jaipur) ---
export const seedJaipurData = async () => {
  const db = await initDB();
  const tx = db.transaction(['ledgers', 'vouchers'], 'readwrite');
  const lStore = tx.objectStore('ledgers');
  const vStore = tx.objectStore('vouchers');

  const existing = await lStore.getAll();
  if (existing.some(l => l.name === 'Cash (Jaipur)')) return; 

  // Ledgers
  const ledgers: Ledger[] = [
    { name: 'Cash (Jaipur)', code: '1001', group: 'Cash-in-Hand', openingBalance: 50000, openingBalanceType: 'Dr', currentBalance: 50000 },
    { name: 'Sales A/c', code: '3001', group: 'Sales Accounts', openingBalance: 0, currentBalance: 0 },
    { name: 'Purchase A/c', code: '4001', group: 'Purchase Accounts', openingBalance: 0, currentBalance: 0 },
    { name: 'Shyam (Staff)', code: '2001', group: 'Loans & Advances (Asset)', openingBalance: 0, currentBalance: 0 },
    { name: 'Ram (Customer)', code: '2002', group: 'Sundry Debtors', openingBalance: 0, currentBalance: 0 }
  ];

  const ledgerIds: Record<string, number> = {};

  for (const l of ledgers) {
    const id = await lStore.add(l);
    ledgerIds[l.name] = id;
  }

  const updateBal = async (id: number, amount: number, type: 'Dr' | 'Cr') => {
      const l = await lStore.get(id);
      if(l) {
          let change = 0;
          const isAssetOrExp = ['Cash-in-Hand', 'Loans & Advances (Asset)', 'Sundry Debtors', 'Purchase Accounts', 'Direct Expenses'].includes(l.group);
          
          if (isAssetOrExp) {
              change = type === 'Dr' ? amount : -amount;
          } else { // Income/Liability
              change = type === 'Cr' ? amount : -amount;
          }
          l.currentBalance = (l.currentBalance || 0) + change;
          await lStore.put(l);
      }
  };

  const today = new Date().toISOString().split('T')[0];

  // 1. Cash Sales 10000
  await vStore.add({
      type: 'Sales',
      date: today,
      referenceNo: 'INV-JP-001',
      partyLedgerId: ledgerIds['Cash (Jaipur)'],
      items: [{ itemId: ledgerIds['Sales A/c'], itemName: 'Sales A/c', amount: 10000, quantity: 1, rate: 10000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 10000,
      totalTax: 0,
      narration: 'Cash Sales in Jaipur'
  });
  await updateBal(ledgerIds['Cash (Jaipur)'], 10000, 'Dr');
  await updateBal(ledgerIds['Sales A/c'], 10000, 'Cr');

  // 2. Cash Purchase 2000
  await vStore.add({
      type: 'Purchase',
      date: today,
      referenceNo: 'PUR-JP-001',
      partyLedgerId: ledgerIds['Cash (Jaipur)'],
      items: [{ itemId: ledgerIds['Purchase A/c'], itemName: 'Purchase A/c', amount: 2000, quantity: 1, rate: 2000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 2000,
      totalTax: 0,
      narration: 'Cash Purchase'
  });
  await updateBal(ledgerIds['Purchase A/c'], 2000, 'Dr');
  await updateBal(ledgerIds['Cash (Jaipur)'], 2000, 'Cr');

  // 3. Employee Advance (Shyam) 3000
  await vStore.add({
      type: 'Payment',
      date: today,
      referenceNo: 'PMT-JP-001',
      partyLedgerId: ledgerIds['Shyam (Staff)'],
      items: [{ itemId: ledgerIds['Cash (Jaipur)'], itemName: 'Cash (Jaipur)', amount: 3000, quantity: 1, rate: 3000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 3000,
      totalTax: 0,
      narration: 'Advance to Shyam'
  });
  await updateBal(ledgerIds['Shyam (Staff)'], 3000, 'Dr');
  await updateBal(ledgerIds['Cash (Jaipur)'], 3000, 'Cr');

  // 4. Credit Sale (Ram) 30000
  await vStore.add({
      type: 'Sales',
      date: today,
      referenceNo: 'INV-JP-002',
      partyLedgerId: ledgerIds['Ram (Customer)'],
      items: [{ itemId: ledgerIds['Sales A/c'], itemName: 'Sales A/c', amount: 30000, quantity: 1, rate: 30000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 30000,
      totalTax: 0,
      narration: 'Credit Sale to Ram'
  });
  await updateBal(ledgerIds['Ram (Customer)'], 30000, 'Dr');
  await updateBal(ledgerIds['Sales A/c'], 30000, 'Cr');

  await tx.done;
};

// --- Mock Data Seeding (Jodhpur) ---
export const seedJodhpurData = async () => {
  const db = await initDB();
  const tx = db.transaction(['ledgers', 'vouchers'], 'readwrite');
  const lStore = tx.objectStore('ledgers');
  const vStore = tx.objectStore('vouchers');

  // Check if already seeded to prevent duplicates
  const existing = await lStore.getAll();
  if (existing.some(l => l.name === 'Cash (Jodhpur)')) return;

  const ledgersToCreate: Ledger[] = [
      { name: 'Cash (Jodhpur)', code: '1002', group: 'Cash-in-Hand', openingBalance: 75000, openingBalanceType: 'Dr', currentBalance: 75000 },
      { name: 'Radhey Shyam (Staff)', code: '2003', group: 'Loans & Advances (Asset)', openingBalance: 0, currentBalance: 0 },
      { name: 'Ramesh (Customer)', code: '2004', group: 'Sundry Debtors', openingBalance: 0, currentBalance: 0 }
  ];

  // Common Accounts (Sales/Purchase)
  // We'll check if they exist in `existing` array.
  let salesId = existing.find(l => l.name === 'Sales A/c')?.id;
  let purchaseId = existing.find(l => l.name === 'Purchase A/c')?.id;

  const ledgerIds: Record<string, number> = {};

  // Create Jodhpur specific ledgers
  for (const l of ledgersToCreate) {
      const id = await lStore.add(l);
      ledgerIds[l.name] = id;
  }

  // If Sales/Purchase don't exist (Jaipur seed didn't run), create them.
  if (!salesId) {
      const s = { name: 'Sales A/c', code: '3001', group: 'Sales Accounts', openingBalance: 0, currentBalance: 0 };
      salesId = await lStore.add(s as Ledger);
  }
  if (!purchaseId) {
      const p = { name: 'Purchase A/c', code: '4001', group: 'Purchase Accounts', openingBalance: 0, currentBalance: 0 };
      purchaseId = await lStore.add(p as Ledger);
  }

  ledgerIds['Sales A/c'] = salesId!;
  ledgerIds['Purchase A/c'] = purchaseId!;

  const updateBal = async (id: number, amount: number, type: 'Dr' | 'Cr') => {
      const l = await lStore.get(id);
      if(l) {
          let change = 0;
          const isAssetOrExp = ['Cash-in-Hand', 'Loans & Advances (Asset)', 'Sundry Debtors', 'Purchase Accounts', 'Direct Expenses'].includes(l.group);
          
          if (isAssetOrExp) {
              change = type === 'Dr' ? amount : -amount;
          } else { // Income/Liability
              change = type === 'Cr' ? amount : -amount;
          }
          l.currentBalance = (l.currentBalance || 0) + change;
          await lStore.put(l);
      }
  };

  const today = new Date().toISOString().split('T')[0];

  // 1. Cash Sales 100,000
  await vStore.add({
      type: 'Sales',
      date: today,
      referenceNo: 'INV-JD-001',
      partyLedgerId: ledgerIds['Cash (Jodhpur)'],
      items: [{ itemId: ledgerIds['Sales A/c'], itemName: 'Sales A/c', amount: 100000, quantity: 1, rate: 100000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 100000,
      totalTax: 0,
      narration: 'Cash Sales in Jodhpur'
  });
  await updateBal(ledgerIds['Cash (Jodhpur)'], 100000, 'Dr');
  await updateBal(ledgerIds['Sales A/c'], 100000, 'Cr');

  // 2. Cash Purchase 20,050
  await vStore.add({
      type: 'Purchase',
      date: today,
      referenceNo: 'PUR-JD-001',
      partyLedgerId: ledgerIds['Cash (Jodhpur)'],
      items: [{ itemId: ledgerIds['Purchase A/c'], itemName: 'Purchase A/c', amount: 20050, quantity: 1, rate: 20050, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 20050,
      totalTax: 0,
      narration: 'Cash Purchase Jodhpur'
  });
  await updateBal(ledgerIds['Purchase A/c'], 20050, 'Dr');
  await updateBal(ledgerIds['Cash (Jodhpur)'], 20050, 'Cr');

  // 3. Employee Advance (Radhey Shyam) 35,000
  await vStore.add({
      type: 'Payment',
      date: today,
      referenceNo: 'PMT-JD-001',
      partyLedgerId: ledgerIds['Radhey Shyam (Staff)'],
      items: [{ itemId: ledgerIds['Cash (Jodhpur)'], itemName: 'Cash (Jodhpur)', amount: 35000, quantity: 1, rate: 35000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 35000,
      totalTax: 0,
      narration: 'Advance to Radhey Shyam'
  });
  await updateBal(ledgerIds['Radhey Shyam (Staff)'], 35000, 'Dr');
  await updateBal(ledgerIds['Cash (Jodhpur)'], 35000, 'Cr');

  // 4. Credit Sale (Ramesh) 30,000
  await vStore.add({
      type: 'Sales',
      date: today,
      referenceNo: 'INV-JD-002',
      partyLedgerId: ledgerIds['Ramesh (Customer)'],
      items: [{ itemId: ledgerIds['Sales A/c'], itemName: 'Sales A/c', amount: 30000, quantity: 1, rate: 30000, gstRate: 0, igst: 0, cgst: 0, sgst: 0 }],
      totalAmount: 30000,
      totalTax: 0,
      narration: 'Credit Sale to Ramesh'
  });
  await updateBal(ledgerIds['Ramesh (Customer)'], 30000, 'Dr');
  await updateBal(ledgerIds['Sales A/c'], 30000, 'Cr');

  await tx.done;
};
