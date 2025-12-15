
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ImportDocumentModule } from './modules/ImportDocumentModule';
import { ReportsModule } from './modules/ReportsModule';
import { MergeReportsModule } from './modules/MergeReportsModule';
import { MasterDataModule } from './modules/MasterDataModule';
import { PendingInvoicesModule } from './modules/PendingInvoicesModule';
import { UploadedInvoicesModule } from './modules/UploadedInvoicesModule';
import { ReportSectionModule } from './modules/ReportSectionModule';
import { SettingsModule } from './modules/SettingsModule';
import { LoginModule } from './modules/LoginModule';
import { PayrollModule } from './modules/PayrollModule';
import { EmployeeManagementModule } from './modules/EmployeeManagementModule';
import { AttendanceModule } from './modules/AttendanceModule';
import { BranchProfileModule } from './modules/BranchProfileModule';
import { InventoryModule } from './modules/InventoryModule';
import { AccountingModule } from './modules/AccountingModule';
import { PettyCashModule } from './modules/PettyCashModule';
import { PartnerPortalModule } from './modules/PartnerPortalModule';
import { AuditModule } from './modules/AuditModule';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutDashboard, PieChart, TrendingUp, Users, FileCheck, DollarSign, Activity, ArrowUpRight, Database, MapPin, ChevronDown, CheckSquare, Square, Calendar, AlertCircle, FileText, Download } from 'lucide-react';
import { Permission, Branch } from './types';
import { getAllBranches, getAllReports } from './utils/db';

// Helper to safely extract values from dynamic keys
const getVal = (row: any, keys: string[]) => {
    const key = Object.keys(row).find(k => keys.some(search => k.toLowerCase().includes(search)));
    return key ? row[key] : 'N/A';
};

// ... [DashboardModule, Unauthorized, AuthenticatedApp components] ...
// Re-inserting DashboardModule, Unauthorized, AuthenticatedApp to ensure file integrity

const DashboardModule = () => {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // Empty array implies 'All'
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  
  const [dateFilter, setDateFilter] = useState({ type: 'this_month', label: 'This Month' });
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const [stats, setStats] = useState({
      totalInvoices: 0,
      pendingUploads: 0,
      totalUploads: 0
  });

  interface PendingItem { invNo: string; supplier: string; amount: string; date: string; }
  const [pendingList, setPendingList] = useState<PendingItem[]>([]);

  useEffect(() => {
    getAllBranches().then(setBranches).catch(console.error);
    calculateStats();
  }, []);

  const calculateStats = async () => {
      try {
          const reports = await getAllReports();
          let totalInv = 0;
          let withPdf = 0;
          const pendingItems: PendingItem[] = [];

          reports.forEach(r => {
              r.data.forEach(row => {
                  totalInv++;
                  if (row["PDF File"]) {
                      withPdf++;
                  } else {
                      const invNo = String(getVal(row, ['invoice number', 'inv no', 'invoice no']) || 'Unknown');
                      const supplier = String(getVal(row, ['trade/legal name', 'supplier', 'party', 'name']) || 'Unknown');
                      const val = getVal(row, ['invoice value', 'value', 'amount', 'total']);
                      const amount = val ? `₹${val}` : '-';
                      const date = String(getVal(row, ['invoice date', 'date']) || '-');
                      pendingItems.push({ invNo, supplier, amount, date });
                  }
              });
          });

          setStats({ totalInvoices: totalInv, pendingUploads: totalInv - withPdf, totalUploads: withPdf });
          setPendingList(pendingItems);
      } catch (error) { console.error("Failed to calculate dashboard stats", error); }
  };

  const handleDownloadReport = async () => {
    const reports = await getAllReports();
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Upload Status Summary Report\n";
    csvContent += `Generated On,${new Date().toLocaleString()}\n\n`;
    csvContent += `Total Invoices to Upload,${stats.totalInvoices}\nInvoices Uploaded,${stats.totalUploads}\nPending Invoices,${stats.pendingUploads}\nCompletion Rate,${stats.totalInvoices > 0 ? ((stats.totalUploads / stats.totalInvoices) * 100).toFixed(1) : 0}%\n\n`;
    csvContent += "S.No,Supplier Name,Invoice Number,Invoice Date,Invoice Value,Status,Source File\n";
    let counter = 1;
    reports.forEach(report => {
        report.data.forEach(row => {
            const supplier = getVal(row, ['trade/legal name', 'supplier', 'name', 'party']) || '';
            const invNo = getVal(row, ['invoice number', 'inv no', 'invoice no']) || '';
            const invDate = getVal(row, ['invoice date', 'date']) || '';
            const invVal = getVal(row, ['invoice value', 'value', 'amount']) || '';
            const status = row["PDF File"] ? "Uploaded" : "Pending";
            const escape = (str: any) => `"${String(str).replace(/"/g, '""')}"`;
            csvContent += `${counter++},${escape(supplier)},${escape(invNo)},${escape(invDate)},${escape(invVal)},${status},${escape(report.fileName)}\n`;
        });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `upload_status_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev => prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]);
  };

  const getBranchLabel = () => {
      if (selectedBranches.length === 0 || selectedBranches.length === branches.length) return 'All Locations';
      if (selectedBranches.length === 1) {
          const b = branches.find(branch => branch.id === selectedBranches[0]);
          return b ? b.name : selectedBranches[0];
      }
      return `${selectedBranches.length} Locations`;
  };
  
  const handlePresetChange = (type: string, label: string) => { setDateFilter({ type, label }); setIsDateDropdownOpen(false); };
  const applyCustomDate = () => { if(customDates.start && customDates.end) { setDateFilter({ type: 'custom', label: `${customDates.start} to ${customDates.end}` }); setIsDateDropdownOpen(false); } };

  return (
  <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1><p className="text-gray-500">Welcome back, {currentUser?.name}. Real-time insights from Master Data.</p></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto relative z-20">
            <div className="relative">
                <button onClick={() => { setIsBranchDropdownOpen(!isBranchDropdownOpen); setIsDateDropdownOpen(false); }} className="flex items-center justify-between gap-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all px-3 py-2.5 min-w-[220px]">
                    <div className="flex items-center gap-2 truncate"><MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" /><span className="truncate max-w-[150px] font-medium">{getBranchLabel()}</span></div><ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isBranchDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-black ring-opacity-5">
                        <div className="p-2"><button onClick={() => { setSelectedBranches([]); setIsBranchDropdownOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-lg transition-colors text-sm text-gray-800 font-medium">{selectedBranches.length === 0 ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />} All Locations</button><div className="h-px bg-gray-100 my-1 mx-2"></div><div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">{branches.map(b => (<button key={b.id} onClick={(e) => { e.stopPropagation(); toggleBranch(b.id); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors text-sm text-gray-600">{selectedBranches.includes(b.id) ? (<CheckSquare className="w-5 h-5 text-blue-600" />) : (<Square className="w-5 h-5 text-gray-400" />)}<div className="flex flex-col items-start truncate"><span className="truncate font-medium">{b.name}</span><span className="text-xs text-gray-400">{b.location}</span></div></button>))}</div></div><div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium"><span>{selectedBranches.length > 0 ? selectedBranches.length : branches.length} selected</span><button onClick={() => setIsBranchDropdownOpen(false)} className="text-blue-600 hover:text-blue-700 hover:underline">Apply Filter</button></div>
                    </div>
                )}
            </div>
            <div className="relative">
                <button onClick={() => { setIsDateDropdownOpen(!isDateDropdownOpen); setIsBranchDropdownOpen(false); }} className="flex items-center justify-between gap-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all px-3 py-2.5 min-w-[200px]"><div className="flex items-center gap-2 truncate"><Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" /><span className="truncate max-w-[140px] font-medium">{dateFilter.label}</span></div><ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} /></button>
                {isDateDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-black ring-opacity-5"><div className="p-2 grid grid-cols-2 gap-1"><div className="col-span-2 text-xs font-semibold text-gray-500 px-2 py-1">Common Ranges</div><button onClick={() => handlePresetChange('this_week', 'This Week')} className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">This Week</button><button onClick={() => handlePresetChange('last_week', 'Last Week')} className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">Last Week</button><button onClick={() => handlePresetChange('this_month', 'This Month')} className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">This Month</button><button onClick={() => handlePresetChange('last_month', 'Last Month')} className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">Last Month</button><button onClick={() => handlePresetChange('fy_current', 'FY 2024-25')} className="col-span-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md">FY 2024-25</button></div><div className="border-t border-gray-100 p-3 bg-gray-50"><div className="text-xs font-semibold text-gray-500 mb-2">Custom Range</div><div className="flex flex-col gap-2"><div className="flex gap-2"><div className="flex-1"><label className="text-[10px] text-gray-400 block mb-0.5">Start Date</label><input type="date" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none" value={customDates.start} onChange={(e) => setCustomDates({...customDates, start: e.target.value})} /></div><div className="flex-1"><label className="text-[10px] text-gray-400 block mb-0.5">End Date</label><input type="date" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none" value={customDates.end} onChange={(e) => setCustomDates({...customDates, end: e.target.value})} /></div></div><button onClick={applyCustomDate} disabled={!customDates.start || !customDates.end} className="w-full bg-blue-600 text-white text-xs font-medium py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">Apply Range</button></div></div></div>
                )}
            </div>
            <button onClick={handleDownloadReport} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors shadow-sm whitespace-nowrap"><Download className="w-4 h-4" /> Download Report</button>
        </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><div className="flex justify-between items-start"><div><p className="text-sm font-medium text-gray-500">Total Invoices</p><h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.totalInvoices.toLocaleString()}</h3></div><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><FileCheck className="w-6 h-6" /></div></div></div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><div className="flex justify-between items-start"><div><p className="text-sm font-medium text-gray-500">Pending Uploads</p><h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.pendingUploads.toLocaleString()}</h3></div><div className="p-2 bg-orange-50 rounded-lg text-orange-600"><AlertCircle className="w-6 h-6" /></div></div></div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"><div className="flex justify-between items-start"><div><p className="text-sm font-medium text-gray-500">Total Uploads</p><h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.totalUploads.toLocaleString()}</h3></div><div className="p-2 bg-green-50 rounded-lg text-green-600"><FileText className="w-6 h-6" /></div></div></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6"><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-gray-900">Pending Uploads Queue</h3></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm whitespace-nowrap"><thead className="uppercase tracking-wider border-b-2 border-gray-100 bg-gray-50/50"><tr><th className="px-4 py-3 text-gray-500 font-medium">Invoice No</th><th className="px-4 py-3 text-gray-500 font-medium">Supplier</th><th className="px-4 py-3 text-gray-500 font-medium text-right">Amount</th><th className="px-4 py-3 text-gray-500 font-medium text-center">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{pendingList.slice(0, 5).map((item, i) => (<tr key={i} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-gray-900">{item.invNo}</td><td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={item.supplier}>{item.supplier}</td><td className="px-4 py-3 text-gray-900 text-right">{item.amount}</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-100">Pending</span></td></tr>))}</tbody></table></div></div><div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-gray-900">Recent Activity</h3><button className="text-blue-600 text-sm hover:underline">View All</button></div><div className="space-y-6">{[{ action: 'GSTR-2B Uploaded', user: 'System Admin', time: '2 hours ago', icon: FileCheck, color: 'text-blue-500 bg-blue-50' }, { action: 'Report Merged', user: 'Finance User', time: '5 hours ago', icon: Activity, color: 'text-purple-500 bg-purple-50' }, { action: 'New User Added', user: 'HR Manager', time: '1 day ago', icon: Users, color: 'text-green-500 bg-green-50' }, { action: 'Master Data Sync', user: 'System', time: '1 day ago', icon: Database, color: 'text-orange-500 bg-orange-50' }].map((item, idx) => (<div key={idx} className="flex items-start gap-3"><div className={`p-2 rounded-lg ${item.color} mt-0.5`}><item.icon className="w-4 h-4" /></div><div><p className="text-sm font-medium text-gray-900">{item.action}</p><p className="text-xs text-gray-500">by {item.user} &bull; {item.time}</p></div></div>))}</div></div></div>
  </div>
  );
};

const Unauthorized = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="bg-red-50 p-4 rounded-full mb-4"><Users className="w-8 h-8 text-red-500" /></div><h3 className="text-xl font-bold text-gray-900">Access Denied</h3><p>You do not have permission to view this module.</p>
  </div>
);

const AuthenticatedApp = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { hasPermission } = useAuth();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return hasPermission('dashboard:view') ? <DashboardModule /> : <Unauthorized />;
      case 'import-document': return hasPermission('uploader:use') ? <ImportDocumentModule /> : <Unauthorized />;
      case 'report-section': return hasPermission('reports:view') ? <ReportSectionModule /> : <Unauthorized />;
      case 'branch-profile': return hasPermission('branches:manage') ? <BranchProfileModule /> : <Unauthorized />;
      case 'employees': return hasPermission('employees:view') ? <EmployeeManagementModule /> : <Unauthorized />;
      case 'attendance': return hasPermission('attendance:view') ? <AttendanceModule /> : <Unauthorized />;
      case 'payroll': return hasPermission('payroll:access') ? <PayrollModule /> : <Unauthorized />;
      case 'analytics': return hasPermission('analytics:view') ? <MasterDataModule /> : <Unauthorized />;
      case 'settings': return hasPermission('settings:access') ? <SettingsModule /> : <Unauthorized />;
      case 'inventory': return hasPermission('inventory:view') ? <InventoryModule /> : <Unauthorized />;
      case 'accounting': return hasPermission('accounting:view') ? <AccountingModule /> : <Unauthorized />;
      case 'petty-cash': return hasPermission('petty_cash:view') ? <PettyCashModule /> : <Unauthorized />;
      case 'audit-trail': return hasPermission('audit:view') ? <AuditModule /> : <Unauthorized />;
      default: return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col transition-all duration-300">
      <Sidebar activeModule={activeModule} onChangeModule={setActiveModule} isOpen={isSidebarOpen} />
      <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <Header isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth h-[calc(100vh-4rem)]">{renderModule()}</main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
       <AuthWrapper />
    </AuthProvider>
  );
}

const AuthWrapper = () => {
    const { isLoading, currentUser, currentExternalUser } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Check for External Login (Partner Portal)
    if (currentExternalUser) {
        return <PartnerPortalModule />;
    }

    // Check for Internal User
    if (!currentUser) {
        return <LoginModule />;
    }

    return <AuthenticatedApp />;
};

export default App;
