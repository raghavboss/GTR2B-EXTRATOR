import React, { useState, useEffect } from 'react';
import { FileCheck, Download, Info, History, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { AnalysisView } from '../components/AnalysisView';
import { parseGstr2bExcel } from '../utils/excelParser';
import { saveReport, getAllReports } from '../utils/db';
import { AppState, ExtractionResult, SavedReport } from '../types';

export const Gstr2bModule = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());
  const [recentFiles, setRecentFiles] = useState<SavedReport[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing filenames and history
  useEffect(() => {
    const fetchData = async () => {
      const reports = await getAllReports();
      // Set duplicate check set
      const names = new Set(reports.map(r => r.fileName || ''));
      setExistingFiles(names);
      
      // Set recent files list (Top 5 most recent)
      const sorted = reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentFiles(sorted.slice(0, 5));
    };
    fetchData();
  }, [saveSuccess]); 

  const handleFileSelect = async (file: File) => {
    // Note: We loosen the duplicate check because we might be uploading a file that has multiple sheets,
    // and we might have saved only one of them before, or we want to allow saving other sheets.
    // However, for strictness, we can check if any report has this filename.
    // Given we append sheet names now, let's just proceed or warn.
    // For now, we'll process it.

    setAppState(AppState.PROCESSING);
    setError(null);
    try {
      const data = await parseGstr2bExcel(file);
      // Attach filename to all results
      const resultsWithMeta = data.map(r => ({ ...r, fileName: file.name }));
      setResults(resultsWithMeta);
      setAppState(AppState.VIEW_DATA);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred processing the file.');
      setAppState(AppState.IDLE);
    }
  };

  const handleSaveToDb = async () => {
    if (results.length === 0) return;
    setIsSaving(true);
    try {
      // Save each sheet as a separate report
      for (const result of results) {
        // Construct a unique filename for the report based on sheet name if multiple exist
        const displayFileName = result.sheetName ? `${result.fileName} (${result.sheetName})` : result.fileName;
        
        // Basic duplicate check before saving this specific sheet
        if (!existingFiles.has(displayFileName!)) {
            await saveReport({
                ...result,
                fileName: displayFileName,
                createdAt: new Date().toISOString()
            });
        }
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save", err);
      alert("Failed to save report to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setAppState(AppState.IDLE);
    setResults([]);
    setError(null);
  };

  if (appState === AppState.VIEW_DATA && results.length > 0) {
    return (
      <AnalysisView 
        data={results}
        onBack={handleBack}
        onSave={handleSaveToDb}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        isSavedMode={false}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Upload GSTR-2B Document</h1>
                <p className="text-gray-500 text-sm mt-1">Parse official government portal Excel exports for automated B2B invoice analysis.</p>
            </div>
            <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Download Template
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Upload Area */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px]">
                     <div className="w-full">
                        <FileUpload 
                            onFileSelect={handleFileSelect} 
                            isProcessing={appState === AppState.PROCESSING}
                            error={error}
                            allowedExtensions={['.xlsx', '.xls']}
                            label="Upload GSTR-2B Excel"
                        />
                     </div>
                     <div className="mt-6 text-center text-xs text-gray-400 max-w-md">
                        <p>Your data is processed locally in your browser for maximum security. No invoice data is uploaded to our servers.</p>
                     </div>
                </div>
            </div>

            {/* Sidebar Information */}
            <div className="space-y-6">
                {/* Instructions Card */}
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 shadow-sm">
                    <h3 className="text-blue-900 font-semibold flex items-center mb-4">
                        <Info className="w-5 h-5 mr-2" />
                        Upload Guidelines
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-3">
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Supported format: <strong>.xlsx</strong> or <strong>.xls</strong> only.
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Supported Sheets: <strong>B2B</strong>, <strong>B2B-CDNR</strong>, <strong>B2BA</strong>.
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Maximum file size: 25MB.
                        </li>
                    </ul>
                </div>

                 {/* Recent Uploads Card */}
                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                            <History className="w-4 h-4 mr-2 text-gray-500" />
                            Recent Uploads
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {recentFiles.length > 0 ? (
                            recentFiles.map(file => (
                                <div key={file.id} className="p-4 hover:bg-blue-50 transition-colors group cursor-default">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-1.5 bg-green-100 rounded text-green-600">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors" title={file.fileName}>
                                                {file.fileName}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {new Date(file.createdAt).toLocaleDateString()} &bull; {file.data.length} records
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-sm text-gray-500">No history found.</p>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};
