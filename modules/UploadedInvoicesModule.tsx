import React, { useState, useEffect } from 'react';
import { FileCheck, Download, FileText, Search, Filter, Eye } from 'lucide-react';
import { getAllReports } from '../utils/db';
import { InvoiceRow } from '../types';
import DataTable from '../components/DataTable';

// Helper to safely extract values from dynamic keys
const getVal = (row: any, keys: string[]) => {
    const key = Object.keys(row).find(k => keys.some(search => k.toLowerCase().includes(search)));
    return key ? row[key] : null;
};

export const UploadedInvoicesModule = () => {
  const [loading, setLoading] = useState(true);
  const [uploadedData, setUploadedData] = useState<InvoiceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Headers including 'PDF File' which DataTable handles specifically for viewing/downloading
  const REPORT_HEADERS = ["S.No.", "Supplier Name", "Invoice Number", "Invoice Date", "Taxable Value", "Tax Amount", "Source File", "PDF File"];

  useEffect(() => {
    loadUploadedData();
  }, []);

  const loadUploadedData = async () => {
    setLoading(true);
    try {
      const reports = await getAllReports();
      let rows: InvoiceRow[] = [];
      let counter = 1;

      reports.forEach(report => {
        report.data.forEach((row, index) => {
          // Check if PDF IS attached (opposite of pending)
          if (row["PDF File"]) {
            
            // Extract standard fields
            const supplier = getVal(row, ['trade/legal name', 'supplier', 'party', 'name']) || 'Unknown';
            const invNo = getVal(row, ['invoice number', 'inv no', 'invoice no']) || 'Unknown';
            const date = getVal(row, ['invoice date', 'date', 'dt']) || '-';
            
            const taxable = getVal(row, ['taxable value', 'taxable']) || 0;
            
            let taxSum = 0;
            const igst = parseFloat(String(getVal(row, ['integrated tax', 'igst']) || 0));
            const cgst = parseFloat(String(getVal(row, ['central tax', 'cgst']) || 0));
            const sgst = parseFloat(String(getVal(row, ['state/ut tax', 'state tax', 'sgst']) || 0));
            if (!isNaN(igst)) taxSum += igst;
            if (!isNaN(cgst)) taxSum += cgst;
            if (!isNaN(sgst)) taxSum += sgst;

            rows.push({
              "S.No.": counter++,
              "Supplier Name": supplier,
              "Invoice Number": invNo,
              "Invoice Date": date,
              "Taxable Value": taxable,
              "Tax Amount": taxSum.toFixed(2),
              "Source File": report.fileName || 'Unknown',
              "PDF File": row["PDF File"], // Contains { name, data, type }
              
              // Metadata
              "_reportId": report.id,
              "_rowIndex": index,
              ...row 
            });
          }
        });
      });

      setUploadedData(rows);
    } catch (err) {
      console.error("Failed to load uploaded data", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = uploadedData.filter(row => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
        String(row["Supplier Name"]).toLowerCase().includes(searchLower) ||
        String(row["Invoice Number"]).toLowerCase().includes(searchLower)
    );
  });

  const handleDownloadCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    // Exclude 'PDF File' object column from CSV text
    const csvHeaders = REPORT_HEADERS.filter(h => h !== 'PDF File');
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
    link.setAttribute("download", `uploaded_invoices_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileCheck className="w-7 h-7 text-green-600" />
                    Uploaded Invoices Report
                </h1>
                <p className="text-gray-500 mt-1">
                    List of completed master data records with attached PDF proofs. Total Uploaded: <span className="font-bold text-green-600">{uploadedData.length}</span>
                </p>
            </div>
            <button 
                onClick={handleDownloadCsv}
                disabled={uploadedData.length === 0}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500 outline-none w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 border-l border-gray-200 pl-4">
                <Filter className="w-4 h-4" />
                Showing {filteredData.length} of {uploadedData.length} items
            </div>
        </div>

        {/* Report Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {uploadedData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-gray-50 p-4 rounded-full mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No Uploads Yet</h3>
                    <p className="text-gray-500">You haven't uploaded any PDF proofs for invoices yet.</p>
                </div>
            ) : (
                <DataTable 
                    headers={REPORT_HEADERS} 
                    data={filteredData} 
                    fullScreen={false}
                />
            )}
        </div>
    </div>
  );
};
