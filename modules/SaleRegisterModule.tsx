import React, { useState, useEffect } from 'react';
import { FileText, Download, Info, History, FileCheck } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { AnalysisView } from '../components/AnalysisView';
import { saveReport, getAllReports } from '../utils/db';
import { geminiService } from '../services/geminiService';
import { AppState, ExtractionResult, SavedReport } from '../types';

export const SaleRegisterModule = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());
  const [recentFiles, setRecentFiles] = useState<SavedReport[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing filenames and history (filtered for PDFs usually, but we track all reports)
  useEffect(() => {
    const fetchData = async () => {
      const reports = await getAllReports();
      const names = new Set(reports.map(r => r.fileName || ''));
      setExistingFiles(names);
      
      const sorted = reports
        .filter(r => r.fileName?.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setRecentFiles(sorted.slice(0, 5));
    };
    fetchData();
  }, [saveSuccess]); 

  const handleFileSelect = async (file: File) => {
    if (existingFiles.has(file.name)) {
      setError(`Duplicate detected: The file "${file.name}" is already in your saved reports.`);
      return;
    }

    setAppState(AppState.PROCESSING);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
            const base64String = (reader.result as string).split(',')[1];
            const data = await geminiService.extractFromPdf(base64String, file.name);
            setResult(data);
            setAppState(AppState.VIEW_DATA);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'AI processing failed.');
            setAppState(AppState.IDLE);
        }
      };
      
      reader.onerror = () => {
          setError("Failed to read file.");
          setAppState(AppState.IDLE);
      };

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setAppState(AppState.IDLE);
    }
  };

  const handleSaveToDb = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      await saveReport({
        ...result,
        createdAt: new Date().toISOString()
      });
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
    setResult(null);
    setError(null);
  };

  if (appState === AppState.VIEW_DATA && result) {
    return (
      <AnalysisView 
        data={result}
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
                <h1 className="text-2xl font-bold text-gray-900">Upload Sale Register (PDF)</h1>
                <p className="text-gray-500 text-sm mt-1">AI-powered extraction of tabular data from scanned or digital Sale Register PDFs.</p>
            </div>
            <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
                <Download className="w-4 h-4 mr-2" />
                Sample PDF
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
                            allowedExtensions={['.pdf']}
                            label="Upload Sale Register PDF"
                        />
                     </div>
                     <div className="mt-6 text-center text-xs text-gray-400 max-w-md">
                        <p>Powered by Gemini 2.5 Flash. Processing may take up to 30 seconds depending on document complexity.</p>
                     </div>
                </div>
            </div>

            {/* Sidebar Information */}
            <div className="space-y-6">
                {/* Instructions Card */}
                <div className="bg-purple-50 rounded-xl p-5 border border-purple-100 shadow-sm">
                    <h3 className="text-purple-900 font-semibold flex items-center mb-4">
                        <Info className="w-5 h-5 mr-2" />
                        Usage Guide
                    </h3>
                    <ul className="text-sm text-purple-800 space-y-3">
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Supported format: <strong>.pdf</strong>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Works best with clear, computer-generated PDFs.
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Automatically detects headers and line items.
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">&bull;</span>
                            Max file size: 20MB.
                        </li>
                    </ul>
                </div>

                 {/* Recent Uploads Card */}
                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-semibold text-gray-900 flex items-center text-sm">
                            <History className="w-4 h-4 mr-2 text-gray-500" />
                            Recent PDF Uploads
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {recentFiles.length > 0 ? (
                            recentFiles.map(file => (
                                <div key={file.id} className="p-4 hover:bg-purple-50 transition-colors group cursor-default">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 p-1.5 bg-red-100 rounded text-red-600">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-700 transition-colors" title={file.fileName}>
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
                                <p className="text-sm text-gray-500">No PDF history found.</p>
                            </div>
                        )}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};
