import React, { useState, useEffect, useMemo } from 'react';
import { Database, Filter, Download, DollarSign, FileSpreadsheet, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { getAllReports, updateReport } from '../utils/db';
import { SavedReport, InvoiceRow } from '../types';
import DataTable from '../components/DataTable';

export const MasterDataModule = () => {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<InvoiceRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const reports = await getAllReports();
      setFileCount(reports.length);

      if (reports.length === 0) {
        setAllData([]);
        setHeaders([]);
        setLoading(false);
        return;
      }

      // 1. Collect all unique headers from all reports
      const headerSet = new Set<string>();
      // Always put Source File and S.No first
      const systemHeaders = ["S.No.", "Source File"];
      
      reports.forEach(report => {
        report.headers.forEach(h => {
          if (h !== "S.No.") headerSet.add(h);
        });
      });

      // Convert to array
      const dynamicHeaders = Array.from(headerSet);

      // INSERT "PDF File" column after "IRN Date"
      // Find index of IRN Date (case insensitive)
      let irnIndex = dynamicHeaders.findIndex(h => h.toLowerCase().includes('irn date'));
      if (irnIndex === -1) {
         irnIndex = dynamicHeaders.findIndex(h => h.toLowerCase().includes('irn'));
      }

      if (irnIndex !== -1) {
        // Insert after IRN Date
        dynamicHeaders.splice(irnIndex + 1, 0, "PDF File");
      } else {
        // If IRN date not found, just add it at the end
        dynamicHeaders.push("PDF File");
      }

      const masterHeaders = [...systemHeaders, ...dynamicHeaders];
      setHeaders(masterHeaders);

      // 2. Flatten data
      let combinedData: InvoiceRow[] = [];
      let counter = 1;

      reports.forEach(report => {
        report.data.forEach((row, index) => {
          const newRow: InvoiceRow = { ...row };
          
          // Normalize S.No
          newRow["S.No."] = counter++;
          // Add Source File
          newRow["Source File"] = report.fileName || "Unknown";

          // Add hidden metadata to track row origin for updates
          newRow["_reportId"] = report.id;
          newRow["_rowIndex"] = index;

          // Ensure all fields exist
          dynamicHeaders.forEach(h => {
            if (newRow[h] === undefined) {
              newRow[h] = null;
            }
          });

          combinedData.push(newRow);
        });
      });

      setAllData(combinedData);
    } catch (err) {
      console.error("Failed to load master data", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = async (row: InvoiceRow, file: File) => {
    try {
      const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const base64 = await toBase64(file);
      const fileData = { name: file.name, data: base64, type: file.type };

      const reportId = row["_reportId"] as number;
      const rowIndex = row["_rowIndex"] as number;

      const reports = await getAllReports();
      const report = reports.find(r => r.id === reportId);
      
      if (report && report.data[rowIndex]) {
         report.data[rowIndex]["PDF File"] = fileData;
         await updateReport(report);
         
         // Reload data to reflect changes
         await loadAllData();
         showToast("PDF file successfully saved!", 'success');
      }
    } catch (error) {
       console.error("Failed to upload file", error);
       showToast("Failed to upload PDF file.", 'error');
    }
  };

  const handleFileDelete = async (row: InvoiceRow) => {
      if (!confirm("Are you sure you want to delete this PDF?")) return;

      try {
        const reportId = row["_reportId"] as number;
        const rowIndex = row["_rowIndex"] as number;

        const reports = await getAllReports();
        const report = reports.find(r => r.id === reportId);
        
        if (report && report.data[rowIndex]) {
            delete report.data[rowIndex]["PDF File"];
            await updateReport(report);
            await loadAllData();
            showToast("PDF file removed.", 'success');
        }
      } catch (error) {
        console.error("Failed to delete file", error);
        showToast("Failed to delete PDF.", 'error');
      }
  };

  // Calculate Summaries with robust dynamic key matching
  const stats = useMemo(() => {
    let totalTaxable = 0;
    let totalIGST = 0;
    let totalCGST = 0;
    let totalSGST = 0;

    const parseAmount = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        // Handle "1,23,456.00" or "123456" or " ₹ 100 "
        const cleanStr = String(val).replace(/[^0-9.-]/g, '');
        return parseFloat(cleanStr) || 0;
    };

    // Dynamically find the correct headers based on keywords
    // This handles variations like "Taxable Value", "Taxable Value (₹)", "taxable value", etc.
    const findHeaderKey = (keywords: string[]) => {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        // Find a header that contains any of the keywords
        return headers.find(h => {
            const lowerH = h.toLowerCase();
            return lowerKeywords.some(k => lowerH.includes(k));
        });
    };

    const taxableKey = findHeaderKey(['taxable value']);
    const igstKey = findHeaderKey(['integrated tax']);
    const cgstKey = findHeaderKey(['central tax']);
    const sgstKey = findHeaderKey(['state/ut tax', 'state tax']);

    allData.forEach(row => {
        if (taxableKey) totalTaxable += parseAmount(row[taxableKey]);
        if (igstKey) totalIGST += parseAmount(row[igstKey]);
        if (cgstKey) totalCGST += parseAmount(row[cgstKey]);
        if (sgstKey) totalSGST += parseAmount(row[sgstKey]);
    });

    return {
        totalTaxable,
        totalTax: totalIGST + totalCGST + totalSGST,
        totalIGST,
        totalCGST
    };
  }, [allData, headers]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
  }

  if (fileCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] bg-white rounded-xl border border-dashed border-gray-300 m-8">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                <Database className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500 max-w-sm text-center">
                Upload and save GSTR-2B files to populate the Master Data view.
            </p>
        </div>
      );
  }

  return (
    // Adjusted height to account for nested navigation header (approx 11rem offset from viewport)
    <div className="flex flex-col h-[calc(100vh-11rem)] p-2 gap-4 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all transform duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors">
                <X className="w-4 h-4" />
            </button>
        </div>
      )}

      {/* Header & Stats */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center px-2">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Database className="w-6 h-6 text-blue-600" />
                    Master Data View
                </h1>
                <p className="text-sm text-gray-500">
                    Consolidated view of {fileCount} files and {allData.length} records
                </p>
            </div>
            <button 
                onClick={loadAllData} 
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Refresh Data"
            >
                <RefreshCw className="w-5 h-5" />
            </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase">Total Taxable Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalTaxable)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase">Total Tax Liability</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(stats.totalTax)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase">Integrated Tax (IGST)</p>
                <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(stats.totalIGST)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase">Central Tax (CGST)</p>
                <p className="text-xl font-semibold text-gray-700 mt-1">{formatCurrency(stats.totalCGST)}</p>
            </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable 
            headers={headers} 
            data={allData} 
            fullScreen={true}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
        />
      </div>
    </div>
  );
};
