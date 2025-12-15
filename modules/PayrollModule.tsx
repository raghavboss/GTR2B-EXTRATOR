
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Users, ArrowUpRight, ArrowDownRight, Search, Calendar, DollarSign, CheckCircle, FileText, Download, Briefcase, Building2, MoreHorizontal, X, Printer, MapPin, Phone, Mail } from 'lucide-react';
import { getAllUsers, getAllBranches, getAllDepartments, getAllAttendance, getBusinessProfile } from '../utils/db';
import { User, Branch, Department, AttendanceRecord, BusinessProfile } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PayrollEmployee extends User {
  calculatedGross: number; // Earnings after attendance factor
  totalDeductions: number;
  netSalary: number;
  daysPresent: number;
  status: 'Active' | 'On Leave' | 'Terminated';
  departmentName?: string;
  payDetails?: {
      earnedBasic: number;
      earnedHra: number;
      earnedSpecial: number;
      pf: number;
      pt: number;
      tds: number;
  };
}

export const PayrollModule = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'run-payroll'>('overview');
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingSlipFor, setViewingSlipFor] = useState<PayrollEmployee | null>(null);
  
  // Current Payroll Month (Defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [users, allAttendance, deps, branchList, profile] = await Promise.all([
          getAllUsers(), 
          getAllAttendance(), 
          getAllDepartments(),
          getAllBranches(),
          getBusinessProfile()
      ]);

      setBranches(branchList);
      setBusinessProfile(profile || null);

      // Filter attendance for selected month
      const currentMonthStr = selectedMonth.toISOString().slice(0, 7); // YYYY-MM
      
      const enrichedUsers = users.map((u) => {
        // Attendance Logic
        const userAttendance = allAttendance.filter(r => 
            r.userId === u.id && 
            r.date.startsWith(currentMonthStr) && 
            (r.status === 'Present' || r.status === 'Half-Day')
        );
        
        const daysPresent = userAttendance.reduce((acc, curr) => acc + (curr.status === 'Half-Day' ? 0.5 : 1), 0);
        const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
        
        // --- Salary Calculation Logic ---
        // Defaults if structure missing
        const struct = u.salaryStructure || { 
            basic: u.baseSalary || 0, 
            hra: 0, 
            specialAllowance: 0, 
            pfDeduction: false, 
            professionalTax: 0, 
            tds: 0 
        };

        const attendanceFactor = daysPresent / daysInMonth;

        // Earnings (Pro-rata based on attendance)
        const earnedBasic = Math.round(struct.basic * attendanceFactor);
        const earnedHra = Math.round(struct.hra * attendanceFactor);
        const earnedSpecial = Math.round(struct.specialAllowance * attendanceFactor);
        
        const grossEarnings = earnedBasic + earnedHra + earnedSpecial;

        // Deductions
        const pf = struct.pfDeduction ? Math.round(earnedBasic * 0.12) : 0;
        const pt = struct.professionalTax;
        const tds = struct.tds;
        
        const totalDeductions = pf + pt + tds;
        const netSalary = Math.max(0, grossEarnings - totalDeductions);

        const dept = deps.find(d => d.id === u.departmentId)?.name || 'General';
        
        return {
          ...u,
          daysPresent,
          calculatedGross: grossEarnings,
          totalDeductions,
          netSalary,
          payDetails: {
              earnedBasic, earnedHra, earnedSpecial, pf, pt, tds
          },
          status: u.isActive ? 'Active' : 'Terminated',
          departmentName: dept
        } as PayrollEmployee;
      });

      setEmployees(enrichedUsers);
    } catch (e) {
      console.error("Failed to load payroll data", e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const stats = useMemo(() => {
    const totalPayout = employees.filter(e => e.status === 'Active').reduce((sum, e) => sum + e.netSalary, 0);
    const totalGross = employees.filter(e => e.status === 'Active').reduce((sum, e) => sum + e.calculatedGross, 0);
    const totalDeductions = employees.filter(e => e.status === 'Active').reduce((sum, e) => sum + e.totalDeductions, 0);
    const activeCount = employees.filter(e => e.status === 'Active').length;
    
    return { totalPayout, totalGross, totalDeductions, activeCount };
  }, [employees]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Payroll & Salary Management
          </h1>
          <p className="text-gray-500 mt-1">Automated salary calculation for every employee based on attendance.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                {selectedMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            {['overview', 'employees', 'run-payroll'].map((tab) => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all capitalize ${
                    activeTab === tab 
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                >
                {tab.replace('-', ' ')}
                </button>
            ))}
            </div>
        </div>
      </header>

      {activeTab === 'overview' && <PayrollOverview stats={stats} formatCurrency={formatCurrency} />}
      {activeTab === 'employees' && <EmployeeTable employees={employees} formatCurrency={formatCurrency} onViewSlip={setViewingSlipFor} />}
      {activeTab === 'run-payroll' && <RunPayroll employees={employees} stats={stats} formatCurrency={formatCurrency} />}

      {viewingSlipFor && (
          <PayslipModal 
            employee={viewingSlipFor} 
            month={selectedMonth} 
            businessProfile={businessProfile}
            branches={branches}
            onClose={() => setViewingSlipFor(null)} 
            formatCurrency={formatCurrency}
          />
      )}
    </div>
  );
};

// --- Sub Components ---

const PayrollOverview = ({ stats, formatCurrency }: any) => {
  return (
    <div className="space-y-6 animate-fade-in">
       {/* Stats Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start">
                   <div>
                       <p className="text-sm font-medium text-gray-500">Total Net Payable</p>
                       <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(stats.totalPayout)}</h3>
                   </div>
                   <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                       <DollarSign className="w-6 h-6" />
                   </div>
               </div>
               <div className="mt-4 flex items-center text-sm text-green-600">
                   <ArrowUpRight className="w-4 h-4 mr-1" />
                   <span className="font-medium">Final Disbursal</span>
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start">
                   <div>
                       <p className="text-sm font-medium text-gray-500">Total Gross Earnings</p>
                       <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(stats.totalGross)}</h3>
                   </div>
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                       <Wallet className="w-6 h-6" />
                   </div>
               </div>
               <div className="mt-4 text-sm text-gray-400">
                   Before Deductions
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start">
                   <div>
                       <p className="text-sm font-medium text-gray-500">Active Employees</p>
                       <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.activeCount}</h3>
                   </div>
                   <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                       <Users className="w-6 h-6" />
                   </div>
               </div>
               <div className="mt-4 flex items-center text-sm text-gray-400">
                   <span className="font-medium text-gray-700">{stats.activeCount}</span> on payroll
               </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start">
                   <div>
                       <p className="text-sm font-medium text-gray-500">Total Deductions</p>
                       <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(stats.totalDeductions)}</h3>
                   </div>
                   <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                       <FileText className="w-6 h-6" />
                   </div>
               </div>
               <div className="mt-4 text-sm text-gray-400">
                   PF, PT, TDS
               </div>
           </div>
       </div>

       {/* Recent Payroll Activity */}
       <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
           <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Pay Runs</h3>
           <div className="space-y-4">
               {[
                   { month: 'June 2025', date: 'Jun 30, 2025', amount: stats.totalPayout, status: 'Completed', users: stats.activeCount },
                   { month: 'May 2025', date: 'May 31, 2025', amount: stats.totalPayout * 0.98, status: 'Completed', users: stats.activeCount - 1 },
                   { month: 'April 2025', date: 'Apr 30, 2025', amount: stats.totalPayout * 0.95, status: 'Completed', users: stats.activeCount - 2 },
               ].map((run, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                       <div className="flex items-center gap-4">
                           <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                               <Calendar className="w-5 h-5" />
                           </div>
                           <div>
                               <h4 className="font-semibold text-gray-900">{run.month}</h4>
                               <p className="text-xs text-gray-500">Executed on {run.date}</p>
                           </div>
                       </div>
                       <div className="text-right hidden sm:block">
                           <p className="font-bold text-gray-900">{formatCurrency(run.amount)}</p>
                           <p className="text-xs text-gray-500">{run.users} Employees</p>
                       </div>
                       <div className="flex items-center gap-2">
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                               {run.status}
                           </span>
                           <button className="p-1.5 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600">
                               <Download className="w-4 h-4" />
                           </button>
                       </div>
                   </div>
               ))}
           </div>
       </div>
    </div>
  );
};

const EmployeeTable = ({ employees, formatCurrency, onViewSlip }: { employees: PayrollEmployee[], formatCurrency: (n: number) => string, onViewSlip: (e: PayrollEmployee) => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const filtered = employees.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search employees..." 
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-sm text-gray-500">
                    Showing {filtered.length} employees
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Attendance</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Earnings</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Pay</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filtered.map((emp, i) => (
                            <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                            <div className="text-xs text-gray-500">{emp.departmentName} &bull; {emp.roleId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${
                                        emp.daysPresent > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {emp.daysPresent} Days
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                                    {formatCurrency(emp.calculatedGross)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-500">
                                    -{formatCurrency(emp.totalDeductions)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-600">
                                    {formatCurrency(emp.netSalary)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => onViewSlip(emp)}
                                        className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                    >
                                        View Slip
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface PayslipProps { 
    employee: PayrollEmployee;
    month: Date;
    businessProfile: BusinessProfile | null;
    branches: Branch[];
    onClose: () => void;
    formatCurrency: (n: number) => string;
}

const PayslipModal = ({ employee, month, businessProfile, branches, onClose, formatCurrency }: PayslipProps) => {
    const payslipRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Determine Company Info based on Business Profile + Employee Branch
    const companyName = businessProfile?.legalName || businessProfile?.companyName || "Company Name";
    const companyLogo = businessProfile?.logoUrl;
    
    // Find employee branch
    const empBranchId = employee.branchIds && employee.branchIds.length > 0 ? employee.branchIds[0] : null;
    const branchInfo = branches.find(b => b.id === empBranchId);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        if (!payslipRef.current) return;
        setIsDownloading(true);
        try {
            // Wait for images/fonts if needed, usually simple html is fast
            const canvas = await html2canvas(payslipRef.current, {
                scale: 2, // Better resolution
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Payslip_${employee.name.replace(/\s+/g, '_')}_${month.getMonth()+1}_${month.getFullYear()}.pdf`);
        } catch (e) {
            console.error("PDF Export failed", e);
            alert("Failed to generate PDF. Please try printing to PDF instead.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in print:p-0 print:bg-white print:absolute print:inset-0">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[95vh] overflow-y-auto print:shadow-none print:max-h-full print:w-full print:max-w-full">
                {/* Actions Header (Hidden when printing) */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                        Payslip Preview
                    </h3>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isDownloading ? (
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2"/>
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Export PDF
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Payslip Content */}
                <div ref={payslipRef} className="bg-white">
                    <div className="p-8 print:p-8 space-y-6">
                        {/* Header with Business Profile Info */}
                        <div className="flex flex-col items-center text-center border-b-2 border-gray-100 pb-6">
                            {companyLogo && (
                                <img src={companyLogo} alt="Logo" className="h-16 w-auto object-contain mb-3" />
                            )}
                            <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{companyName}</h1>
                            <div className="text-sm text-gray-500 mt-1 flex flex-col items-center gap-1 max-w-lg">
                                {/* Only Contact Info (Address and GSTIN Removed) */}
                                <div className="flex flex-wrap justify-center gap-4 mt-1">
                                    {(businessProfile?.phone || businessProfile?.email) && (
                                        <>
                                            {businessProfile.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    <span>{businessProfile.phone}</span>
                                                </div>
                                            )}
                                            {businessProfile.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    <span>{businessProfile.email}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 mt-5 bg-gray-100 inline-block px-6 py-1.5 rounded-full border border-gray-200">
                                Payslip for {month.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                        </div>

                        {/* Employee Details */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
                            <div className="space-y-2">
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500">Employee Name</span>
                                    <span className="font-semibold text-gray-900">{employee.name}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500">Employee ID</span>
                                    <span className="font-semibold text-gray-900">EMP-{employee.id?.toString().padStart(4, '0')}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500">Department</span>
                                    <span className="font-semibold text-gray-900">{employee.departmentName}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500">Designation</span>
                                    <span className="font-semibold text-gray-900 capitalize">{employee.roleId.replace('_', ' ')}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-500">Paid Days</span>
                                    <span className="font-semibold text-gray-900">{employee.daysPresent} Days</span>
                                </div>
                            </div>
                        </div>

                        {/* Salary Table */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm">
                                <div className="p-3 border-r border-gray-200 text-center text-green-700">Earnings</div>
                                <div className="p-3 text-center text-red-700">Deductions</div>
                            </div>
                            <div className="grid grid-cols-2 text-sm">
                                {/* Earnings Column */}
                                <div className="border-r border-gray-200 p-4 space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Basic Salary</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.earnedBasic || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">HRA</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.earnedHra || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Special Allowance</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.earnedSpecial || 0)}</span>
                                    </div>
                                </div>

                                {/* Deductions Column */}
                                <div className="p-4 space-y-3 bg-gray-50/30">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Provident Fund (PF)</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.pf || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Professional Tax</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.pt || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">TDS (Tax)</span>
                                        <span className="font-medium">{formatCurrency(employee.payDetails?.tds || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="grid grid-cols-2 border-t border-gray-200 bg-gray-50 text-sm font-bold">
                                <div className="p-3 border-r border-gray-200 flex justify-between">
                                    <span>Gross Earnings</span>
                                    <span>{formatCurrency(employee.calculatedGross)}</span>
                                </div>
                                <div className="p-3 flex justify-between text-red-600">
                                    <span>Total Deductions</span>
                                    <span>{formatCurrency(employee.totalDeductions)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Pay */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex justify-between items-center">
                            <div>
                                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Net Pay</p>
                                <p className="text-xs text-indigo-400 mt-1 italic">Amount transferred to bank account</p>
                            </div>
                            <div className="text-2xl font-bold text-indigo-700">
                                {formatCurrency(employee.netSalary)}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-8 text-center text-xs text-gray-400">
                            <p>This is a computer-generated document and does not require a signature.</p>
                            <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RunPayroll = ({ employees, stats, formatCurrency }: any) => {
    const [step, setStep] = useState(1);
    const [processing, setProcessing] = useState(false);
    
    const handleProcess = () => {
        setProcessing(true);
        setTimeout(() => {
            setProcessing(false);
            setStep(3);
        }, 3000);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[500px] flex flex-col items-center justify-center animate-fade-in">
            {step === 1 && (
                <div className="text-center max-w-lg">
                    <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Run Payroll</h2>
                    <p className="text-gray-500 mb-8">
                        Process salary payments for <span className="font-semibold text-gray-900">{stats.activeCount} employees</span>. 
                        Total Net Payable is <span className="font-semibold text-gray-900">{formatCurrency(stats.totalPayout)}</span>.
                    </p>
                    
                    <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left text-sm border border-gray-100">
                        <h4 className="font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-2">Payroll Summary</h4>
                        <div className="flex justify-between py-1">
                            <span className="text-gray-500">Gross Earnings</span>
                            <span className="font-medium">{formatCurrency(stats.totalGross)}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-gray-500">Total Deductions</span>
                            <span className="font-medium text-red-500">-{formatCurrency(stats.totalDeductions)}</span>
                        </div>
                        <div className="flex justify-between py-2 mt-2 border-t border-gray-200">
                            <span className="font-bold text-gray-900">Net Payable</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(stats.totalPayout)}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setStep(2)}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                    >
                        Review & Confirm
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="text-center w-full max-w-md">
                     <h2 className="text-xl font-bold text-gray-900 mb-6">Processing Payroll...</h2>
                     
                     <div className="space-y-4 mb-8">
                         <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                             <span className="text-sm font-medium text-gray-600 flex items-center">
                                 {processing ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2"/> : <CheckCircle className="w-4 h-4 text-emerald-500 mr-2"/>}
                                 Calculating Tax Deductions
                             </span>
                         </div>
                         <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                             <span className="text-sm font-medium text-gray-600 flex items-center">
                                 {processing ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" style={{animationDelay: '0.5s'}}/> : <CheckCircle className="w-4 h-4 text-emerald-500 mr-2"/>}
                                 Generating Payslips
                             </span>
                         </div>
                         <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                             <span className="text-sm font-medium text-gray-600 flex items-center">
                                 {processing ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2" style={{animationDelay: '1s'}}/> : <CheckCircle className="w-4 h-4 text-emerald-500 mr-2"/>}
                                 Updating Bank Records
                             </span>
                         </div>
                     </div>

                     {!processing && (
                        <div className="animate-fade-in">
                            <button onClick={handleProcess} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700">
                                Confirm Transfer
                            </button>
                        </div>
                     )}
                     
                     {/* Auto-trigger simulation */}
                     {useEffect(() => {
                         if(step === 2 && !processing) handleProcess();
                     }, []) as any}
                </div>
            )}

            {step === 3 && (
                <div className="text-center">
                    <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Payroll Run Successful!</h2>
                    <p className="text-gray-500 mb-8 max-w-sm">
                        Salaries have been processed and payslips generated for {stats.activeCount} employees.
                    </p>
                    
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => setStep(1)}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                        >
                            Close
                        </button>
                        <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center">
                            <Download className="w-4 h-4 mr-2" /> Download Report
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
