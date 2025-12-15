import React, { useState, useEffect } from 'react';
import { FileDiff, Search, Filter, RefreshCw, Download } from 'lucide-react';
import { getAllReports } from '../utils/db';
import { InvoiceRow } from '../types';
import DataTable from '../components/DataTable';

export const B2baModule = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const reports = await getAllReports();
      // Filter for B2BA sheets
      const b2baReports = reports.filter(r => r.sheetName === 'B2BA');

      if (b2baReports.length === 0) {
        setData([]);
        setHeaders([]);
        setLoading(false);
        return;
      }

      // Collect headers
      const headerSet = new Set<string>();
      headerSet.add("S.No.");
      headerSet.add("Source File");
      
      b2baReports.forEach(r => {
        r.headers.forEach(h => {
            if(h !== "S.No.") headerSet.add(h);
        });
      });
      const masterHeaders = Array.from(headerSet);
      setHeaders(masterHeaders);

      // Flatten data
      let rows: InvoiceRow[] = [];
      let counter = 1;
      b2baReports.forEach(r => {
          r.data.forEach(row => {
              rows.push({
                  ...row,
                  "S.No.": counter++,
                  "Source File": r.fileName || 'Unknown'
              });
          });
      });

      setData(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(row => {
      if(!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      // Simple search across all values
      return Object.values(row).some(v => String(v).toLowerCase().includes(lower));
  });

  const handleDownloadCsv = () => {
    if (headers.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";

    filteredData.forEach(row => {
        const rowStr = headers.map(header => {
            const val = row[header] ? String(row[header]).replace(/"/g, '""') : '';
            return `"${val}"`;
        }).join(",");
        csvContent += rowStr + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `b2ba_amendments_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileDiff className="w-7 h-7 text-purple-600" />
                    B2BA Report (Amendments)
                </h1>
                <p className="text-gray-500 mt-1">
                    Amended B2B Invoices - {data.length} records found
                </p>
            </div>
            <div className="flex gap-2">
                 <button 
                    onClick={loadData}
                    className="flex items-center px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <button 
                    onClick={handleDownloadCsv}
                    disabled={data.length === 0}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </button>
            </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search records..." 
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-purple-500 focus:border-purple-500 outline-none w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 border-l border-gray-200 pl-4">
                <Filter className="w-4 h-4" />
                Showing {filteredData.length} of {data.length} items
            </div>
        </div>

        {/* Report Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {data.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-purple-50 p-4 rounded-full mb-4">
                        <FileDiff className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No B2BA Data</h3>
                    <p className="text-gray-500">No Amendment records found in uploaded GSTR-2B files.</p>
                </div>
            ) : (
                <DataTable 
                    headers={headers} 
                    data={filteredData} 
                    fullScreen={false}
                />
            )}
        </div>
    </div>
  );
};
