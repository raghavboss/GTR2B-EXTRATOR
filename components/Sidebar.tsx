
import React from 'react';
import { LayoutDashboard, FileText, PieChart, Settings, FolderOpen, Layers, Database, LogOut, ChevronRight, Briefcase, Upload, FileType, FilePlus, FileSpreadsheet, AlertTriangle, FileCheck, ClipboardList, Wallet, Users, CalendarCheck, Building2, Package, Landmark, Coins, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../types';

interface SidebarProps {
  activeModule: string;
  onChangeModule: (module: string) => void;
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onChangeModule, isOpen }) => {
  const { hasPermission } = useAuth();

  const menuGroups = [
    {
        title: 'Overview',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard:view' as Permission },
            { id: 'branch-profile', label: 'Branch Hub', icon: Building2, perm: 'branches:manage' as Permission },
        ]
    },
    {
        title: 'ERP Modules',
        items: [
            { id: 'inventory', label: 'Inventory', icon: Package, perm: 'inventory:view' as Permission },
            { id: 'accounting', label: 'Accounting', icon: Landmark, perm: 'accounting:view' as Permission },
            { id: 'petty-cash', label: 'Petty Cash', icon: Coins, perm: 'petty_cash:view' as Permission },
        ]
    },
    {
        title: 'Documents',
        items: [
            { id: 'import-document', label: 'Import Document', icon: Upload, perm: 'uploader:use' as Permission },
        ]
    },
    {
        title: 'Reports',
        items: [
            { id: 'report-section', label: 'GSTR-2B REPORT', icon: ClipboardList, perm: 'reports:view' as Permission },
        ]
    },
    {
        title: 'Human Resources',
        items: [
            { id: 'employees', label: 'Employees', icon: Users, perm: 'employees:view' as Permission },
            { id: 'attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance:view' as Permission },
            { id: 'payroll', label: 'Payroll', icon: Wallet, perm: 'payroll:access' as Permission },
        ]
    },
    {
        title: 'Data & Analytics',
        items: [
            { id: 'analytics', label: 'Analytics', icon: PieChart, perm: 'analytics:view' as Permission },
        ]
    },
    {
        title: 'Administration',
        items: [
            { id: 'audit-trail', label: 'Audit Trail', icon: Shield, perm: 'audit:view' as Permission },
            { id: 'settings', label: 'Settings', icon: Settings, perm: 'settings:access' as Permission },
        ]
    }
  ];

  return (
    <aside 
        className={`fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out border-r border-slate-800 flex flex-col pt-16
        ${isOpen ? 'w-64' : 'w-20'}`}
    >
      <div className={`flex items-center gap-3 px-6 h-16 absolute top-0 left-0 w-full border-b border-slate-800 transition-all ${isOpen ? 'justify-start' : 'justify-center'}`}>
        <div className="rounded-lg bg-blue-600 p-1.5 shadow-lg shadow-blue-900/50 flex-shrink-0">
          <FileText className="h-6 w-6 text-white" />
        </div>
        <span className={`text-xl font-bold tracking-wide text-slate-100 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            TaxAnalyst
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
        {menuGroups.map((group, idx) => (
            <div key={idx}>
                {isOpen && (
                    <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        {group.title}
                    </h3>
                )}
                <div className="space-y-1">
                    {group.items.map((item) => {
                        // Check if permission exists in current Role
                        if (!hasPermission(item.perm)) return null;
                        const isActive = activeModule === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => onChangeModule(item.id)}
                                title={!isOpen ? item.label : ''}
                                className={`group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative
                                ${isActive
                                    ? 'bg-blue-600/10 text-blue-400'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                }`}
                            >
                                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />}
                                
                                <item.icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
                                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                                }`} />
                                
                                <span className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-slate-800">
         <div className={`rounded-xl bg-slate-800/50 p-3 flex items-center gap-3 transition-all ${isOpen ? '' : 'justify-center p-2'}`}>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-lg flex-shrink-0">
                   <Briefcase className="w-4 h-4" />
              </div>
              {isOpen && (
                <div className="overflow-hidden">
                    <p className="text-xs font-medium text-slate-300">Enterprise Edition</p>
                    <p className="text--[10px] text-slate-500">v2.5.0</p>
                </div>
              )}
         </div>
      </div>
    </aside>
  );
};
