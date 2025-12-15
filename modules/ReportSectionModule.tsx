import React, { useState, useEffect } from 'react';
import { ChevronDown, FileCheck, AlertTriangle, FolderOpen, Layers, Info, FileMinus, FileDiff, Database } from 'lucide-react';
import { PendingInvoicesModule } from './PendingInvoicesModule';
import { UploadedInvoicesModule } from './UploadedInvoicesModule';
import { ReportsModule } from './ReportsModule';
import { MergeReportsModule } from './MergeReportsModule';
import { B2bCdnrModule } from './B2bCdnrModule';
import { B2baModule } from './B2baModule';
import { MasterDataModule } from './MasterDataModule';
import { useAuth } from '../contexts/AuthContext';

export const ReportSectionModule = () => {
  const [currentView, setCurrentView] = useState('pending');
  const { hasPermission } = useAuth();

  // Handle permission-based default view or restricted access
  useEffect(() => {
    // If current view is merge but user lacks permission, switch to pending
    if (currentView === 'merge' && !hasPermission('merge:access')) {
        setCurrentView('pending');
    }
  }, [hasPermission, currentView]);

  const renderContent = () => {
    switch (currentView) {
      case 'pending': return <PendingInvoicesModule />;
      case 'uploaded': return <UploadedInvoicesModule />;
      case 'saved': return <ReportsModule />;
      case 'cdnr': return <B2bCdnrModule />;
      case 'b2ba': return <B2baModule />;
      case 'master-data': 
        return hasPermission('master_data:view') ? <MasterDataModule /> : (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
                <p className="text-red-500">You do not have permission to access Master Data.</p>
            </div>
        );
      case 'merge': 
        return hasPermission('merge:access') ? <MergeReportsModule /> : (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
                <p className="text-red-500">You do not have permission to access Merge Reports.</p>
            </div>
        );
      default: return <PendingInvoicesModule />;
    }
  };

  const getIcon = () => {
      switch(currentView) {
          case 'pending': return <AlertTriangle className="w-6 h-6" />;
          case 'uploaded': return <FileCheck className="w-6 h-6" />;
          case 'saved': return <FolderOpen className="w-6 h-6" />;
          case 'merge': return <Layers className="w-6 h-6" />;
          case 'cdnr': return <FileMinus className="w-6 h-6" />;
          case 'b2ba': return <FileDiff className="w-6 h-6" />;
          case 'master-data': return <Database className="w-6 h-6" />;
          default: return <Info className="w-6 h-6" />;
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Navigation Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shadow-sm transition-all duration-300">
              {getIcon()}
           </div>
           <div>
              <h1 className="text-lg font-bold text-gray-900">GSTR-2B REPORT</h1>
              <p className="text-sm text-gray-500">Centralized hub for all financial reports</p>
           </div>
        </div>

        <div className="relative w-full sm:w-64">
           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Layers className="w-4 h-4 text-gray-400" />
           </div>
           <select 
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value)}
              className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pl-10 pr-10 font-medium transition-colors cursor-pointer hover:bg-gray-100"
           >
              <option value="pending">Pending Invoices Report</option>
              <option value="uploaded">Uploaded Invoices Report</option>
              <option value="cdnr">B2B-CDNR Report</option>
              <option value="b2ba">B2BA (Amendments) Report</option>
              <option value="saved">Saved Reports Library</option>
              {hasPermission('master_data:view') && (
                  <option value="master-data">Master Data View</option>
              )}
              {hasPermission('merge:access') && (
                  <option value="merge">Merge Reports Tool</option>
              )}
           </select>
           <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Module Content */}
      <div className="min-h-[600px]">
         {renderContent()}
      </div>
    </div>
  );
};
