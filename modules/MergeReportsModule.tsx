import React, { useState, useEffect } from 'react';
import { Layers, FileText, CheckSquare, Square, Merge, Filter, AlertCircle } from 'lucide-react';
import { getAllReports, saveReport } from '../utils/db';
import { SavedReport, ExtractionResult, InvoiceRow } from '../types';
import { AnalysisView } from '../components/AnalysisView';
import { generateMarkdownTable } from '../utils/excelParser';

export const MergeReportsModule = () => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergedResult, setMergedResult] = useState<ExtractionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      const reports = await getAllReports();
      setSavedReports(reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === savedReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedReports.map(r => r.id!).filter(Boolean)));
    }
  };

  const handleMerge = () => {
    const selectedReportsList = savedReports.filter(r => r.id && selectedIds.has(r.id));
    
    if (selectedReportsList.length < 2) return;

    // Use headers from the first report as the master schema
    const masterHeaders = selectedReportsList[0].headers;
    
    let combinedData: InvoiceRow[] = [];
    let currentRowCount = 0;

    selectedReportsList.forEach(report => {
      report.data.forEach(row => {
        currentRowCount++;
        // Create a new row object to avoid mutating the original
        // We override "S.No." to be sequential across the merged dataset
        const newRow: InvoiceRow = { ...row, "S.No.": currentRowCount };
        
        // Ensure all master headers exist (fill with empty string if missing in this report)
        masterHeaders.forEach(h => {
          if (newRow[h] === undefined) {
            newRow[h] = '';
          }
        });
        
        combinedData.push(newRow);
      });
    });

    const mergedMarkdown = generateMarkdownTable(masterHeaders, combinedData);
    
    // Construct the result
    const result: ExtractionResult = {
      headers: masterHeaders,
      data: combinedData,
      markdown: mergedMarkdown,
      fileName: `Merged Report (${selectedReportsList.length} files)`
    };

    setMergedResult(result);
  };

  const handleSaveMergedReport = async () => {
    if (!mergedResult) return;
    setIsSaving(true);
    try {
      await saveReport({
        ...mergedResult,
        createdAt: new Date().toISOString()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save merged report", err);
      alert("Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setMergedResult(null);
    setIsSaving(false);
    setSaveSuccess(false);
  };

  // If merged result exists, show the analysis view
  if (mergedResult) {
    return (
      <AnalysisView 
        data={mergedResult} 
        onBack={handleBack}
        onSave={handleSaveMergedReport}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        isSavedMode={false} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      <header className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">Merge Reports</h1>
        <p className="text-gray-500 mt-2">Select multiple GSTR-2B reports to combine them into a single consolidated view.</p>
      </header>

      {savedReports.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 min-h-[400px]">
           <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mb-6">
             <Filter className="w-10 h-10 text-gray-400" />
           </div>
           <h3 className="text-xl font-semibold text-gray-900 mb-2">No reports to merge</h3>
           <p className="text-gray-500 max-w-sm text-center">
             Go to "New Extraction" to upload and save some files first.
           </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
           {/* Toolbar */}
           <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                 <button 
                   onClick={toggleSelectAll}
                   className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                 >
                    {selectedIds.size === savedReports.length && savedReports.length > 0 ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                    )}
                    <span>Select All</span>
                 </button>
                 <span className="text-sm text-gray-500 border-l border-gray-300 pl-4">
                    {selectedIds.size} selected
                 </span>
              </div>

              <button
                onClick={handleMerge}
                disabled={selectedIds.size < 2}
                className={`flex items-center px-6 py-2 rounded-lg font-medium transition-all shadow-sm
                  ${selectedIds.size >= 2 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <Merge className="w-4 h-4 mr-2" />
                Merge & View
              </button>
           </div>

           {/* List */}
           <div className="flex-1 overflow-y-auto p-2">
             <div className="space-y-2">
                {savedReports.map((report) => {
                  const isSelected = report.id ? selectedIds.has(report.id) : false;
                  return (
                    <div 
                      key={report.id}
                      onClick={() => report.id && toggleSelection(report.id)}
                      className={`
                        flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer
                        ${isSelected 
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                        }
                      `}
                    >
                       <div className="flex items-center space-x-4">
                          {isSelected ? (
                             <CheckSquare className="w-6 h-6 text-blue-600 flex-shrink-0" />
                          ) : (
                             <Square className="w-6 h-6 text-gray-300 flex-shrink-0" />
                          )}
                          <div>
                             <h4 className={`font-medium ${isSelected ? 'text-blue-800' : 'text-gray-900'}`}>
                                {report.fileName || 'Untitled Report'}
                             </h4>
                             <p className="text-xs text-gray-500 flex items-center mt-1">
                                {new Date(report.createdAt).toLocaleDateString()} &bull; {report.data.length} records
                             </p>
                          </div>
                       </div>
                       
                       <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-medium text-gray-600">
                          ID: {report.id}
                       </div>
                    </div>
                  );
                })}
             </div>
           </div>
           
           {selectedIds.size > 0 && selectedIds.size < 2 && (
              <div className="p-3 bg-yellow-50 border-t border-yellow-100 flex items-center justify-center text-sm text-yellow-700">
                 <AlertCircle className="w-4 h-4 mr-2" />
                 Select at least 2 reports to enable merging.
              </div>
           )}
        </div>
      )}
    </div>
  );
};
