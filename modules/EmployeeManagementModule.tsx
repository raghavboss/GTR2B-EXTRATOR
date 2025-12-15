
import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Filter, MoreVertical, Edit2, Trash2, Mail, Phone, MapPin, Briefcase, Building2, LayoutGrid, List as ListIcon, Check, X, User as UserIcon, DollarSign, Calculator, IdCard } from 'lucide-react';
import { User, Role, Department, Branch } from '../types';
import { getAllUsers, getAllRoles, getAllDepartments, getAllBranches, saveUser, deleteUser } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';

export const EmployeeManagementModule = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<User>>({});

  const { hasPermission } = useAuth();
  const canManage = hasPermission('employees:manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, r, d, b] = await Promise.all([
        getAllUsers(),
        getAllRoles(),
        getAllDepartments(),
        getAllBranches()
      ]);
      setEmployees(u);
      setRoles(r);
      setDepartments(d);
      setBranches(b);
    } catch (error) {
      console.error("Failed to load employee data", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'all' || emp.departmentId === selectedDept;
    const matchesStatus = selectedStatus === 'all' || 
                          (selectedStatus === 'active' ? emp.isActive : !emp.isActive);
    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleEdit = (emp: User) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingEmployee({
        isActive: true,
        branchIds: branches.length > 0 ? [branches[0].id] : [],
        roleId: roles[roles.length - 1]?.id || 'accountant',
        departmentId: departments[0]?.id || 'FIN',
        // Default Salary Structure
        salaryStructure: {
            basic: 15000,
            hra: 7500,
            specialAllowance: 2500,
            pfDeduction: true,
            professionalTax: 200,
            tds: 0
        },
        createdAt: new Date().toISOString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to remove this employee?")) {
      await deleteUser(id);
      loadData();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    if (!editingEmployee.name || !editingEmployee.email || !editingEmployee.roleId) return;
    
    // New user password check
    if (!editingEmployee.id && !editingEmployee.passwordHash) {
        alert("Password is required for new employees");
        return;
    }

    // Ensure salary structure exists
    if (!editingEmployee.salaryStructure) {
        editingEmployee.salaryStructure = {
            basic: 0, hra: 0, specialAllowance: 0, pfDeduction: false, professionalTax: 0, tds: 0
        };
    }

    try {
        await saveUser(editingEmployee as User);
        setIsModalOpen(false);
        loadData();
    } catch (e) {
        alert("Failed to save employee. Email might be duplicate.");
    }
  };

  const toggleBranchSelection = (branchId: string) => {
    const currentBranches = editingEmployee.branchIds || [];
    const newBranches = currentBranches.includes(branchId) 
        ? currentBranches.filter(id => id !== branchId)
        : [...currentBranches, branchId];
    
    setEditingEmployee({ ...editingEmployee, branchIds: newBranches });
  };

  const calculateCTC = () => {
      const s = editingEmployee.salaryStructure;
      if (!s) return 0;
      return (s.basic || 0) + (s.hra || 0) + (s.specialAllowance || 0);
  };

  // Logic to calculate next ID for display
  const getNextEmployeeId = () => {
      if (employees.length === 0) return 'EMP-0001';
      const maxId = Math.max(...employees.map(e => e.id || 0));
      return `EMP-${(maxId + 1).toString().padStart(4, '0')}`;
  };

  const formatEmployeeId = (id?: number) => {
      if (!id) return getNextEmployeeId();
      return `EMP-${id.toString().padStart(4, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Employee Management
          </h1>
          <p className="text-gray-500 mt-1">Manage staff profiles, auto-generated IDs, and salary structures.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           {canManage && (
               <button 
                 onClick={handleAdd}
                 className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium w-full md:w-auto"
               >
                 <Plus className="w-4 h-4 mr-2" />
                 Add Employee
               </button>
           )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Total Staff</p>
                  <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{employees.filter(e => e.isActive).length}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg text-green-600"><Check className="w-5 h-5" /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Departments</p>
                  <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Briefcase className="w-5 h-5" /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Avg Basic</p>
                  <p className="text-2xl font-bold text-gray-900">
                      ₹{Math.round(employees.reduce((acc, curr) => acc + (curr.salaryStructure?.basic || curr.baseSalary || 0), 0) / (employees.length || 1) / 1000)}k
                  </p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><DollarSign className="w-5 h-5" /></div>
          </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                  type="text" 
                  placeholder="Search by name, ID or email..." 
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
              <select 
                value={selectedDept} 
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
              >
                  <option value="all">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
              >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
              </select>
              <div className="border-l border-gray-300 mx-2 h-9"></div>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  <ListIcon className="w-5 h-5" />
              </button>
          </div>
      </div>

      {/* Content Area */}
      {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEmployees.map(emp => {
                  const basic = emp.salaryStructure?.basic || emp.baseSalary || 0;
                  return (
                  <div key={emp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                      <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                  {emp.name.charAt(0)}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600`}>
                                    {formatEmployeeId(emp.id)}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    emp.isActive 
                                    ? 'bg-green-50 text-green-700 border-green-100' 
                                    : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                    {emp.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                          </div>
                          
                          <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={emp.name}>{emp.name}</h3>
                          <div className="flex items-center text-sm text-gray-500 mb-4 truncate" title={emp.email}>
                              <Mail className="w-3.5 h-3.5 mr-1.5" />
                              {emp.email}
                          </div>

                          <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between text-gray-600 bg-gray-50 p-2 rounded-lg">
                                  <span className="flex items-center"><Briefcase className="w-3.5 h-3.5 mr-2 text-gray-400" /> Dept</span>
                                  <span className="font-medium">{departments.find(d => d.id === emp.departmentId)?.name || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-600 bg-gray-50 p-2 rounded-lg">
                                  <span className="flex items-center"><DollarSign className="w-3.5 h-3.5 mr-2 text-gray-400" /> Basic Pay</span>
                                  <span className="font-medium">₹{basic.toLocaleString()}</span>
                              </div>
                          </div>
                      </div>
                      
                      {canManage && (
                          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(emp)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors shadow-sm">
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => emp.id && handleDelete(emp.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors shadow-sm">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      )}
                  </div>
              )})}
          </div>
      ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee ID</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Basic Pay</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {filteredEmployees.map(emp => (
                          <tr key={emp.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                      {formatEmployeeId(emp.id)}
                                  </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                                          {emp.name.charAt(0)}
                                      </div>
                                      <div>
                                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                          <div className="text-xs text-gray-500">{emp.email}</div>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {roles.find(r => r.id === emp.roleId)?.name || emp.roleId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {departments.find(d => d.id === emp.departmentId)?.name || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                  ₹{(emp.salaryStructure?.basic || emp.baseSalary || 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                  {emp.isActive ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                                  ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  {canManage && (
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:text-blue-900"><Edit2 className="w-4 h-4"/></button>
                                          <button onClick={() => emp.id && handleDelete(emp.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4"/></button>
                                      </div>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">{editingEmployee.id ? 'Edit Employee' : 'Add New Employee'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <form onSubmit={handleSave} className="p-6 space-y-6">
                      
                      {/* Employee ID Display */}
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                  <IdCard className="w-6 h-6" />
                              </div>
                              <div>
                                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Employee ID</p>
                                  <p className="text-lg font-bold text-gray-900">{formatEmployeeId(editingEmployee.id)}</p>
                              </div>
                          </div>
                          {!editingEmployee.id && (
                              <span className="px-2 py-1 bg-white text-blue-600 text-xs font-medium rounded border border-blue-100">
                                  Auto-generated
                              </span>
                          )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                              <input 
                                  type="text" 
                                  required 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                  value={editingEmployee.name || ''}
                                  onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                              <input 
                                  type="email" 
                                  required 
                                  disabled={!!editingEmployee.id}
                                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                  value={editingEmployee.email || ''}
                                  onChange={e => setEditingEmployee({...editingEmployee, email: e.target.value})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingEmployee.id && '(Leave blank to keep current)'}</label>
                          <input 
                              type="password" 
                              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                              value={editingEmployee.passwordHash || ''}
                              onChange={e => setEditingEmployee({...editingEmployee, passwordHash: e.target.value})}
                          />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                              <select 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                  value={editingEmployee.departmentId}
                                  onChange={e => setEditingEmployee({...editingEmployee, departmentId: e.target.value})}
                              >
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select 
                                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                  value={editingEmployee.roleId}
                                  onChange={e => setEditingEmployee({...editingEmployee, roleId: e.target.value})}
                              >
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                          </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                              <Calculator className="w-4 h-4 mr-2 text-blue-600" />
                              Salary Structure (Monthly)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Basic Pay (₹)</label>
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                      value={editingEmployee.salaryStructure?.basic || 0}
                                      onChange={e => setEditingEmployee({
                                          ...editingEmployee, 
                                          salaryStructure: { ...editingEmployee.salaryStructure!, basic: Number(e.target.value) }
                                      })}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">HRA (₹)</label>
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                      value={editingEmployee.salaryStructure?.hra || 0}
                                      onChange={e => setEditingEmployee({
                                          ...editingEmployee, 
                                          salaryStructure: { ...editingEmployee.salaryStructure!, hra: Number(e.target.value) }
                                      })}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Special Allow. (₹)</label>
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                      value={editingEmployee.salaryStructure?.specialAllowance || 0}
                                      onChange={e => setEditingEmployee({
                                          ...editingEmployee, 
                                          salaryStructure: { ...editingEmployee.salaryStructure!, specialAllowance: Number(e.target.value) }
                                      })}
                                  />
                              </div>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Prof. Tax (₹)</label>
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                      value={editingEmployee.salaryStructure?.professionalTax || 0}
                                      onChange={e => setEditingEmployee({
                                          ...editingEmployee, 
                                          salaryStructure: { ...editingEmployee.salaryStructure!, professionalTax: Number(e.target.value) }
                                      })}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">TDS (₹)</label>
                                  <input 
                                      type="number" 
                                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                                      value={editingEmployee.salaryStructure?.tds || 0}
                                      onChange={e => setEditingEmployee({
                                          ...editingEmployee, 
                                          salaryStructure: { ...editingEmployee.salaryStructure!, tds: Number(e.target.value) }
                                      })}
                                  />
                              </div>
                              <div className="flex items-center pt-5">
                                  <label className="flex items-center cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          className="rounded text-blue-600 focus:ring-blue-500"
                                          checked={editingEmployee.salaryStructure?.pfDeduction || false}
                                          onChange={e => setEditingEmployee({
                                              ...editingEmployee, 
                                              salaryStructure: { ...editingEmployee.salaryStructure!, pfDeduction: e.target.checked }
                                          })}
                                      />
                                      <span className="ml-2 text-sm text-gray-700">Deduct PF (12% of Basic)</span>
                                  </label>
                              </div>
                          </div>

                          <div className="mt-4 bg-blue-50 p-3 rounded-lg flex justify-between items-center text-sm border border-blue-100">
                              <span className="text-blue-800 font-medium">Total Gross Monthly CTC:</span>
                              <span className="font-bold text-blue-900 text-lg">₹{calculateCTC().toLocaleString()}</span>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Branch Access</label>
                          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 max-h-32 overflow-y-auto">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {branches.map(b => (
                                      <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                              type="checkbox" 
                                              checked={editingEmployee.branchIds?.includes(b.id) || false}
                                              onChange={() => toggleBranchSelection(b.id)}
                                              className="rounded text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-700">{b.name}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-2">
                          <input 
                              type="checkbox" 
                              id="empActive"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={editingEmployee.isActive ?? true}
                              onChange={e => setEditingEmployee({...editingEmployee, isActive: e.target.checked})}
                          />
                          <label htmlFor="empActive" className="text-sm font-medium text-gray-700">Active Employee</label>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Employee</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
