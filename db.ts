import { openDB, DBSchema } from 'idb';
import { SavedReport, User, Role, Branch, Department } from '../types';

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
}

const DB_NAME = 'gstr2b_analytics_db';
const DB_VERSION = 5; // Incremented for user schema change

const DEFAULT_ROLES: Role[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to all modules and settings.',
    permissions: [
      'dashboard:view', 'gstr2b:extract', 'sale_register:extract', 'uploader:use', 'reports:view', 'reports:delete', 
      'merge:access', 'master_data:view', 'master_data:edit', 'analytics:view', 
      'settings:access', 'users:manage', 'rbac:manage', 'branches:manage', 'departments:manage',
      'payroll:access', 'employees:view', 'employees:manage'
    ]
  },
  {
    id: 'branch_admin',
    name: 'Branch Admin',
    description: 'Can manage extraction and view reports for their branch.',
    permissions: [
      'dashboard:view', 'gstr2b:extract', 'sale_register:extract', 'uploader:use', 'reports:view', 'reports:delete',
      'master_data:view', 'master_data:edit', 'employees:view'
    ]
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Read-only access to reports and data.',
    permissions: [
      'dashboard:view', 'reports:view', 'master_data:view', 'analytics:view'
    ]
  },
  {
    id: 'corporate_viewer',
    name: 'Corporate Viewer',
    description: 'View access to all analytics and merged reports.',
    permissions: [
      'dashboard:view', 'reports:view', 'merge:access', 'master_data:view', 'analytics:view'
    ]
  },
  {
    id: 'hr_manager',
    name: 'HR Manager',
    description: 'Access to payroll modules and employee dashboard.',
    permissions: ['dashboard:view', 'payroll:access', 'employees:view', 'employees:manage']
  }
];

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'hq', name: 'Corporate HQ', location: 'New Delhi', gstin: '07AAACC1234A1Z5' },
  { id: 'jaipur', name: 'Jaipur Branch', location: 'Jaipur, Rajasthan', gstin: '08AABBB5555B1Z1' },
  { id: 'jodhpur', name: 'Jodhpur Branch', location: 'Jodhpur, Rajasthan', gstin: '08AABBB5555B1Z2' }
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
  isActive: true,
  createdAt: new Date().toISOString()
};

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
        
        // Seed Default Admin immediately
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
    },
  });
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
