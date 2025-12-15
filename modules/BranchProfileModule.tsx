
import React, { useState, useEffect, useMemo } from 'react';
import { Building2, MapPin, Phone, Users, Wallet, Briefcase, Mail, Star, UserCheck, Search, ChevronRight } from 'lucide-react';
import { Branch, User, Department } from '../types';
import { getAllBranches, getAllUsers, getAllDepartments } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';

export const BranchProfileModule = () => {
  const { currentUser, hasPermission } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'staff'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, u, d] = await Promise.all([
        getAllBranches(),
        getAllUsers(),
        getAllDepartments()
      ]);

      // Filter branches based on permissions
      let availableBranches = b;
      if (!hasPermission('branches:manage') && currentUser?.branchIds) {
          // If not super admin, only show assigned branches
          availableBranches = b.filter(branch => currentUser.branchIds.includes(branch.id));
      }

      setBranches(availableBranches);
      setUsers(u);
      setDepartments(d);

      if (availableBranches.length > 0) {
        setSelectedBranchId(availableBranches[0].id);
      }
    } catch (e) {
      console.error("Failed to load branch data", e);
    } finally {
      setLoading(false);
    }
  };

  const selectedBranch = useMemo(() => 
    branches.find(b => b.id === selectedBranchId), 
  [branches, selectedBranchId]);

  const branchStaff = useMemo(() => 
    users.filter(u => u.branchIds?.includes(selectedBranchId || '')),
  [users, selectedBranchId]);

  const stats = useMemo(() => {
      const totalStaff = branchStaff.length;
      const activeStaff = branchStaff.filter(u => u.isActive).length;
      
      // Calculate estimated monthly burn for this branch
      const monthlyPayroll = branchStaff.reduce((acc, curr) => {
          if (!curr.isActive) return acc;
          const basic = curr.salaryStructure?.basic || curr.baseSalary || 0;
          const allowances = (curr.salaryStructure?.hra || 0) + (curr.salaryStructure?.specialAllowance || 0);
          return acc + basic + allowances;
      }, 0);

      const deptCounts = new Set(branchStaff.map(u => u.departmentId).filter(Boolean)).size;

      return { totalStaff, activeStaff, monthlyPayroll, deptCounts };
  }, [branchStaff]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: "compact",
      compactDisplay: "short"
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (branches.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
              <Building2 className="w-16 h-16 mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold">No Branches Assigned</h2>
              <p>You don't have access to view any branch profiles.</p>
          </div>
      );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 animate-fade-in">
      {/* Sidebar List */}
      <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
                  Branch Locations
              </h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all group relative ${
                        selectedBranchId === branch.id 
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                      <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{branch.name}</span>
                          {selectedBranchId === branch.id && <ChevronRight className="w-4 h-4 text-indigo-500" />}
                      </div>
                      <div className="flex items-center text-xs opacity-80">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span className="truncate">{branch.location}</span>
                      </div>
                  </button>
              ))}
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {selectedBranch ? (
              <>
                {/* Hero Header */}
                <div className="relative h-48 bg-gradient-to-r from-indigo-600 to-blue-500 flex items-end p-6">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Building2 className="w-64 h-64 text-white transform translate-x-12 -translate-y-12" />
                    </div>
                    
                    <div className="relative z-10 flex items-end w-full gap-6">
                        <div className="h-24 w-24 bg-white rounded-xl shadow-lg flex items-center justify-center text-3xl font-bold text-indigo-600 border-4 border-white/50">
                            {selectedBranch.name.charAt(0)}
                        </div>
                        <div className="text-white mb-1 flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold">{selectedBranch.name}</h1>
                                <span className="px-2 py-1 bg-white/20 rounded text-xs font-mono backdrop-blur-sm border border-white/30">
                                    {selectedBranch.id}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-indigo-100 font-medium">
                                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {selectedBranch.location}</span>
                                {selectedBranch.manager && (
                                    <span className="flex items-center"><UserCheck className="w-4 h-4 mr-1.5" /> Mgr: {selectedBranch.manager}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-4 border-b border-gray-200 divide-x divide-gray-200 bg-gray-50/50">
                    <div className="p-4 text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Staff</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalStaff}</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Depts</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.deptCounts}</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Payroll</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.monthlyPayroll)}</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Compliance</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                            <Star className="w-5 h-5 text-yellow-400 fill-current" />
                            <span className="text-xl font-bold text-gray-900">4.8</span>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <div className="flex border-b border-gray-200 px-6">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('staff')}
                        className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'staff' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Staff Directory ({branchStaff.length})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
                    {activeTab === 'overview' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                                    <Briefcase className="w-5 h-5 mr-2 text-indigo-600" />
                                    Business Details
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="flex items-start">
                                        <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Address</p>
                                            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{selectedBranch.address || selectedBranch.location}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Wallet className="w-5 h-5 text-gray-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">GSTIN</p>
                                            <p className="text-sm text-gray-500 font-mono">{selectedBranch.gstin || 'Not Available'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Phone className="w-5 h-5 text-gray-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Contact Number</p>
                                            <p className="text-sm text-gray-500">{selectedBranch.contactNumber || 'Not Available'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                                <h3 className="font-bold text-gray-900 mb-4">Location Map</h3>
                                <div className="flex-1 bg-gray-100 rounded-lg flex items-center justify-center min-h-[150px] relative overflow-hidden group">
                                    <MapPin className="w-10 h-10 text-gray-300" />
                                    <p className="absolute bottom-4 text-xs text-gray-400">Map Integration Unavailable</p>
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button className="px-4 py-2 bg-white rounded-lg shadow-sm text-sm font-medium text-gray-700">Open in Google Maps</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {branchStaff.length > 0 ? (
                                        branchStaff.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold mr-3">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 capitalize">{user.roleId.replace('_', ' ')}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {departments.find(d => d.id === user.departmentId)?.name || user.departmentId}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.isActive ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                No employees assigned to this branch.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
              </>
          ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                  Select a branch to view details
              </div>
          )}
      </div>
    </div>
  );
};
