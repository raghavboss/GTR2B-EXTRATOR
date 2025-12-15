import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { Gstr2bModule } from './Gstr2bModule';
import { SaleRegisterModule } from './SaleRegisterModule';
import { useAuth } from '../contexts/AuthContext';

export const ImportDocumentModule = () => {
  const { hasPermission } = useAuth();
  const [currentView, setCurrentView] = useState<'gstr2b' | 'sale-register'>('gstr2b');

  // Initialize view based on permissions
  useEffect(() => {
      // If user doesn't have GSTR-2B permission but has Sale Register, default to Sale Register
      if (!hasPermission('gstr2b:extract') && hasPermission('sale_register:extract')) {
          setCurrentView('sale-register');
      }
  }, [hasPermission]);

  const renderContent = () => {
    if (currentView === 'gstr2b' && hasPermission('gstr2b:extract')) return <Gstr2bModule />;
    if (currentView === 'sale-register' && hasPermission('sale_register:extract')) return <SaleRegisterModule />;
    
    return (
        <div className="p-8 text-center bg-white rounded-xl border border-gray-200 mt-6">
            <p className="text-red-500">You do not have permission to view this module.</p>
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
       {/* Navigation Header */}
       <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shadow-sm">
                  <Upload className="w-6 h-6" />
               </div>
               <div>
                  <h1 className="text-lg font-bold text-gray-900">Import Document</h1>
                  <p className="text-sm text-gray-500">Upload GSTR-2B Excel or Sale Register PDF</p>
               </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg self-stretch sm:self-auto">
                {hasPermission('gstr2b:extract') && (
                    <button
                        onClick={() => setCurrentView('gstr2b')}
                        className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            currentView === 'gstr2b' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        GSTR-2B
                    </button>
                )}
                {hasPermission('sale_register:extract') && (
                    <button
                        onClick={() => setCurrentView('sale-register')}
                        className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            currentView === 'sale-register' 
                            ? 'bg-white text-purple-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Sale Register
                    </button>
                )}
            </div>
       </div>

       <div className="min-h-[600px]">
            {renderContent()}
       </div>
    </div>
  );
};
