import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, FileText, Search, ArrowUpRight, Filter, Upload, X, Save, CheckCircle, File, Image as ImageIcon } from 'lucide-react';
import { getAllReports, updateReport } from '../utils/db';
import { InvoiceRow } from '../types';
import DataTable from '../components/DataTable';

// Helper to safely extract values from dynamic keys (same logic as Dashboard)
const getVal = (row: any, keys: string[]) => {
    const key = Object.keys(row).find(k => keys.some(search => k.toLowerCase().includes(search)));
    return key ? row[key] : null;
};

export const PendingInvoicesModule = () => {
  const [loading, setLoading] = useState(true);
  const [pendingData, setPendingData] = useState<InvoiceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Standardized headers for the report with Action column
  const REPORT_HEADERS = ["S.No.", "Supplier Name", "Invoice Number", "Invoice Date", "Taxable Value", "Tax Amount", "Source File", "Action"];

  useEffect(() => {
    loadPendingData();
  }, []);

  const loadPendingData = async () => {
    setLoading(true);
    try {
      const reports = await getAllReports();
      let pendingRows: InvoiceRow[] = [];
      let counter = 1;

      reports.forEach(report => {
        report.data.forEach((row, index) => {
          // Check if PDF is NOT attached
          if (!row["PDF File"]) {
            
            // Extract standard fields using fuzzy matching
            const supplier = getVal(row, ['trade/legal name', 'supplier', 'party', 'name']) || 'Unknown';
            const invNo = getVal(row, ['invoice number', 'inv no', 'invoice no']) || 'Unknown';
            const date = getVal(row, ['invoice date', 'date', 'dt']) || '-';
            
            // Values
            const taxable = getVal(row, ['taxable value', 'taxable']) || 0;
            
            // Calculate Tax (IGST + CGST + SGST)
            let taxSum = 0;
            const igst = parseFloat(String(getVal(row, ['integrated tax', 'igst']) || 0));
            const cgst = parseFloat(String(getVal(row, ['central tax', 'cgst']) || 0));
            const sgst = parseFloat(String(getVal(row, ['state/ut tax', 'state tax', 'sgst']) || 0));
            if (!isNaN(igst)) taxSum += igst;
            if (!isNaN(cgst)) taxSum += cgst;
            if (!isNaN(sgst)) taxSum += sgst;

            pendingRows.push({
              "S.No.": counter++,
              "Supplier Name": supplier,
              "Invoice Number": invNo,
              "Invoice Date": date,
              "Taxable Value": taxable,
              "Tax Amount": taxSum.toFixed(2),
              "Source File": report.fileName || 'Unknown',
              "Action": "Upload", // Placeholder for action column
              
              // Metadata for updates
              "_reportId": report.id,
              "_rowIndex": index,
              ...row 
            });
          }
        });
      });

      setPendingData(pendingRows);
    } catch (err) {
      console.error("Failed to load pending data", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = pendingData.filter(row => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
        String(row["Supplier Name"]).toLowerCase().includes(searchLower) ||
        String(row["Invoice Number"]).toLowerCase().includes(searchLower)
    );
  });

  const handleDownloadCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    // Exclude 'Action' from CSV
    const csvHeaders = REPORT_HEADERS.filter(h => h !== 'Action');
    csvContent += csvHeaders.join(",") + "\n";

    filteredData.forEach(row => {
        const rowStr = csvHeaders.map(header => {
            const val = row[header] ? String(row[header]).replace(/"/g, '""') : '';
            return `"${val}"`;
        }).join(",");
        csvContent += rowStr + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pending_invoices_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Upload Modal Logic ---

  const handleOpenUpload = (row: InvoiceRow) => {
    setSelectedInvoice(row);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInvoice(null);
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 5MB Limit Check
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
          setToast({ message: "Unable to upload: File size exceeds 5MB limit.", type: 'error' });
          e.target.value = ''; // Reset input
          setSelectedFile(null);
          return;
      }

      setSelectedFile(file);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedInvoice || !selectedFile) return;

    setIsSaving(true);
    try {
        // Convert file to Base64
        const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });

        const base64 = await toBase64(selectedFile);
        const fileData = { name: selectedFile.name, data: base64, type: selectedFile.type };

        const reportId = selectedInvoice["_reportId"] as number;
        const rowIndex = selectedInvoice["_rowIndex"] as number;

        // Fetch Reports, Update, Save
        const reports = await getAllReports();
        const report = reports.find(r => r.id === reportId);

        if (report && report.data[rowIndex]) {
            report.data[rowIndex]["PDF File"] = fileData;
            await updateReport(report);
            
            setToast({ message: "File Uploaded Successfully!", type: 'success' });
            setTimeout(() => setToast(null), 3000);
            
            await loadPendingData(); // Refresh list (item should disappear)
            handleCloseModal();
        } else {
            throw new Error("Report or row not found");
        }
    } catch (err) {
        console.error("Save failed", err);
        setToast({ message: "Failed to save file.", type: 'error' });
    } finally {
        setIsSaving(false);
    }
  };

  const getFileIcon = (file: File) => {
      if (file.type.includes('image')) return <ImageIcon className="w-8 h-8 mb-2" />;
      if (file.type.includes('pdf')) return <FileText className="w-8 h-8 mb-2" />;
      return <File className="w-8 h-8 mb-2" />;
  };

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-full relative">
        {/* Toast Notification */}
        {toast && (
            <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all transform duration-300 animate-in fade-in slide-in-from-right-5 ${
                toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
                {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="font-medium">{toast.message}</span>
                <button onClick={() => setToast(null)}><X className="w-4 h-4 ml-2" /></button>
            </div>
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-7 h-7 text-orange-600" />
                    Pending Invoices Report
                </h1>
                <p className="text-gray-500 mt-1">
                    List of master data records pending PDF proof upload. Total Pending: <span className="font-bold text-orange-600">{pendingData.length}</span>
                </p>
            </div>
            <button 
                onClick={handleDownloadCsv}
                disabled={pendingData.length === 0}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
            </button>
        </header>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search by Supplier or Invoice No..." 
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500 outline-none w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 border-l border-gray-200 pl-4">
                <Filter className="w-4 h-4" />
                Showing {filteredData.length} of {pendingData.length} items
            </div>
        </div>

        {/* Report Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {pendingData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-green-50 p-4 rounded-full mb-4">
                        <FileText className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">All Caught Up!</h3>
                    <p className="text-gray-500">There are no pending invoices. All master data records have attached PDFs.</p>
                </div>
            ) : (
                <DataTable 
                    headers={REPORT_HEADERS} 
                    data={filteredData} 
                    fullScreen={false}
                    onAction={handleOpenUpload}
                />
            )}
        </div>

        {/* Upload Modal */}
        {isModalOpen && selectedInvoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-900">Upload Invoice Document</h3>
                        <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 space-y-1">
                            <p><span className="font-semibold">Invoice No:</span> {selectedInvoice["Invoice Number"]}</p>
                            <p><span className="font-semibold">Supplier:</span> {selectedInvoice["Supplier Name"]}</p>
                            <p><span className="font-semibold">Amount:</span> {selectedInvoice["Taxable Value"]}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Select Document</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center">
                                <input 
                                    type="file" 
                                    accept="application/pdf,image/png,image/jpeg,image/jpg"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {selectedFile ? (
                                    <div className="flex flex-col items-center text-green-600">
                                        {getFileIcon(selectedFile)}
                                        <span className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                                        <span className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                        <span className="text-sm">Click to browse or drag file</span>
                                        <span className="text-xs text-gray-400 mt-1">PDF, PNG, JPG (Max 5MB)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                        <button 
                            onClick={handleCloseModal}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveFile}
                            disabled={!selectedFile || isSaving}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save & Resolve
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
