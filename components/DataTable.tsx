import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Upload, Trash2, FileText, Download, ExternalLink, Settings, GripVertical, Eye, EyeOff } from 'lucide-react';
import { InvoiceRow } from '../types';

interface DataTableProps {
  headers: string[];
  data: InvoiceRow[];
  markdown?: string;
  fullScreen?: boolean;
  onFileUpload?: (row: InvoiceRow, file: File) => void;
  onFileDelete?: (row: InvoiceRow) => void;
  onAction?: (row: InvoiceRow) => void; // New prop for custom actions
}

const DataTable: React.FC<DataTableProps> = ({ headers, data, markdown, fullScreen = false, onFileUpload, onFileDelete, onAction }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'markdown'>('table');
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = fullScreen ? 20 : 10;

  // Column Management State
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize column order on mount or headers change
  useEffect(() => {
    setColumnOrder(headers);
    // Reset hidden columns if headers drastically change (optional, but safer)
    setHiddenColumns(new Set());
  }, [headers]);

  // Handle click outside for column menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (markdown) {
        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalPages = Math.ceil(data.length / rowsPerPage);
  
  const currentData = useMemo(() => {
    return data.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [data, currentPage, rowsPerPage]);

  const visibleHeaders = useMemo(() => {
    return columnOrder.filter(h => !hiddenColumns.has(h));
  }, [columnOrder, hiddenColumns]);

  const toggleColumnVisibility = (header: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(header)) {
      newHidden.delete(header);
    } else {
      newHidden.add(header);
    }
    setHiddenColumns(newHidden);
  };

  const onDragStart = (e: React.DragEvent, header: string) => {
    setDraggingColumn(header);
    e.dataTransfer.effectAllowed = 'move';
    // Remove ghost image opacity issues if needed, usually browser handles it ok
  };

  const onDragOver = (e: React.DragEvent, targetHeader: string) => {
    e.preventDefault();
    if (!draggingColumn || draggingColumn === targetHeader) return;

    const currentOrder = [...columnOrder];
    const dragIdx = currentOrder.indexOf(draggingColumn);
    const targetIdx = currentOrder.indexOf(targetHeader);

    if (dragIdx !== -1 && targetIdx !== -1) {
       // Swap logic
       const newOrder = [...columnOrder];
       newOrder.splice(dragIdx, 1);
       newOrder.splice(targetIdx, 0, draggingColumn);
       setColumnOrder(newOrder);
    }
  };

  const onDragEnd = () => {
    setDraggingColumn(null);
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${fullScreen ? 'h-full' : 'h-full'}`}>
      <div className="border-b border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-center bg-gray-50 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
            <div className="flex space-x-1 bg-white p-1 rounded-lg border border-gray-200">
            <button
                onClick={() => setActiveTab('table')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'table' 
                    ? 'bg-blue-50 text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
                Table View
            </button>
            {markdown && (
                <button
                    onClick={() => setActiveTab('markdown')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'markdown' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    Markdown Source
                </button>
            )}
            </div>

            {/* Column Settings Button */}
            {activeTab === 'table' && (
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                        className={`p-2 rounded-lg border transition-colors ${isColumnMenuOpen ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        title="Customize Columns"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    
                    {isColumnMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-fade-in">
                            <div className="p-3 border-b border-gray-100 bg-gray-50">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Configure Columns</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">Drag to reorder &bull; Click eye to toggle</p>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                                {columnOrder.map((header) => {
                                    const isHidden = hiddenColumns.has(header);
                                    return (
                                        <div 
                                            key={header}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, header)}
                                            onDragOver={(e) => onDragOver(e, header)}
                                            onDragEnd={onDragEnd}
                                            className={`
                                                flex items-center gap-2 p-2 rounded-md cursor-grab active:cursor-grabbing text-sm select-none transition-colors
                                                ${draggingColumn === header ? 'bg-blue-50 border border-blue-100 opacity-50' : 'hover:bg-gray-50'}
                                            `}
                                        >
                                            <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <span className={`flex-1 truncate ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {header}
                                            </span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(header); }}
                                                className={`p-1 rounded-md transition-colors ${isHidden ? 'text-gray-400 hover:text-gray-600' : 'text-blue-600 hover:bg-blue-50'}`}
                                            >
                                                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                {data.length.toLocaleString()} records
            </span>
            {markdown && (
                <button
                onClick={handleCopy}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
                >
                {copied ? (
                    <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                    </>
                ) : (
                    <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy MD
                    </>
                )}
                </button>
            )}
        </div>
      </div>

      <div className={`flex-1 overflow-auto ${fullScreen ? '' : 'min-h-[400px] max-h-[600px]'} w-full`}>
        {activeTab === 'table' ? (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  {visibleHeaders.map((header, idx) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50 border-b border-gray-200 first:pl-6 last:pr-6"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentData.length > 0 ? (
                  currentData.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-blue-50/50 transition-colors group">
                      {visibleHeaders.map((header, colIdx) => (
                        <td
                          key={`${rowIdx}-${header}`}
                          className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap border-r border-transparent group-hover:border-gray-100 last:border-none"
                        >
                          {header === 'PDF File' ? (
                            <div className="flex items-center space-x-2">
                              {row[header] && typeof row[header] === 'object' ? (
                                <>
                                  <button
                                    onClick={() => {
                                      const fileData = row[header];
                                      if (fileData.data) {
                                          const link = document.createElement('a');
                                          link.href = fileData.data;
                                          link.download = fileData.name || 'document.pdf';
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                      }
                                    }}
                                    className="flex items-center text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                                    title={row[header].name}
                                  >
                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                    {row[header].name && row[header].name.length > 15 
                                      ? row[header].name.substring(0, 12) + '...' 
                                      : 'View PDF'}
                                  </button>
                                  {onFileDelete && (
                                    <button 
                                        onClick={() => onFileDelete(row)} 
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                        title="Delete PDF"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <label className="cursor-pointer inline-flex items-center bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-200 hover:border-blue-200">
                                  <Upload className="w-3 h-3 mr-1.5" />
                                  Upload
                                  <input 
                                    type="file" 
                                    accept="application/pdf" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0] && onFileUpload) {
                                        onFileUpload(row, e.target.files[0]);
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          ) : header === 'Action' && onAction ? (
                             <button 
                                onClick={() => onAction(row)}
                                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                             >
                                <Upload className="w-3 h-3 mr-1.5" />
                                Upload
                             </button>
                          ) : (
                            row[header] !== undefined && row[header] !== null 
                                ? (typeof row[header] === 'object' ? '[Object]' : String(row[header])) 
                                : ''
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={visibleHeaders.length} className="px-6 py-12 text-center text-gray-500">
                      No data available to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-slate-900 overflow-auto h-full">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre">{markdown}</pre>
          </div>
        )}
      </div>

      {activeTab === 'table' && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * rowsPerPage, data.length)}</span> of{' '}
                <span className="font-medium">{data.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;