import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, FileSpreadsheet, CheckCircle, AlertTriangle, File } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { AnalysisView } from '../components/AnalysisView';
import { parseGstr2bExcel } from '../utils/excelParser';
import { geminiService } from '../services/geminiService';
import { saveReport, getAllReports } from '../utils/db';
import { AppState, ExtractionResult, SavedReport } from '../types';

export const UploaderModule = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchExisting = async () => {
      const reports = await getAllReports();
      const names = new Set(reports.map(r => r.fileName || ''));
      setExistingFiles(names);
    };
    fetchExisting();
  }, [saveSuccess]);

  const handleFileSelect = async (file: File) => {
    // Basic dup check (less strict for multi-sheet)
    if (existingFiles.has(file.name)) {
      // Only warn if exact filename exists, but continue processing? 
      // Current behavior stops. Let's keep it strict but informative.
      // Actually, for multi-sheet, we handle unique naming during save. 
      // Let's rely on save-time dup check for better UX in multi-sheet.
      // But preserving existing behavior for consistency:
      if (existingFiles.has(file.name)) {
           setError(`Duplicate detected: The file "${file.name}" is already in your saved reports.`);
           return;
      }
    }

    setAppState(AppState.PROCESSING);
    setError(null);
    setResults([]);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let data: ExtractionResult[] = [];

      if (ext === 'xlsx' || ext === 'xls') {
         // Handle Excel (GSTR-2B) - returns array
         data = await parseGstr2bExcel(file);
      } else if (ext === 'pdf') {
         // Handle PDF (Sale Register) - returns single object
         const reader = new FileReader();
         const singleData = await new Promise<ExtractionResult>((resolve, reject) => {
             reader.onload = async () => {
                 try {
                     const base64String = (reader.result as string).split(',')[1];
                     const extracted = await geminiService.extractFromPdf(base64String, file.name);
                     resolve(extracted);
                 } catch (e) { reject(e); }
             };
             reader.onerror = () => reject(new Error("Failed to read file"));
             reader.readAsDataURL(file);
         });
         data = [singleData];
      } else {
         throw new Error("Unsupported file format. Please upload .xlsx, .xls, or .pdf.");
      }

      // Add filename to all results
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
      for (const result of results) {
         // Handle naming for multiple sheets
         const displayFileName = result.sheetName ? `${result.fileName} (${result.sheetName})` : result.fileName;
         
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
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pt-4">
        <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Smart Document Uploader</h1>
            <p className="text-gray-500 mt-2">
                Drag and drop your financial documents here. We automatically detect the format and extract data.
            </p>
        </header>

        {/* Unified Upload Zone */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-blue-900/5 p-10 relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-50/50 blur-3xl"></div>
             <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-purple-50/50 blur-3xl"></div>

             <div className="relative z-10 flex flex-col items-center">
                <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full border border-green-100 text-sm font-medium">
                        <FileSpreadsheet className="w-4 h-4" />
                        GSTR-2B (Excel)
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full border border-red-100 text-sm font-medium">
                        <FileText className="w-4 h-4" />
                        Sale Register (PDF)
                    </div>
                </div>
                
                <FileUpload 
                  onFileSelect={handleFileSelect} 
                  isProcessing={appState === AppState.PROCESSING}
                  error={error}
                  allowedExtensions={['.xlsx', '.xls', '.pdf']}
                  label="Drop Excel or PDF here"
                />
                
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="font-semibold text-gray-900 flex items-center mb-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                            Excel Processing
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Automatically parses "B2B", "B2B-CDNR", and "B2BA" sheets from GSTR-2B exports to identify invoice details, credit notes, and amendments.
                        </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="font-semibold text-gray-900 flex items-center mb-2">
                            <CheckCircle className="w-4 h-4 text-purple-500 mr-2" />
                            PDF Intelligence
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Uses Gemini AI to read unstructured PDF Sale Registers and convert tabular data into structured JSON for analysis.
                        </p>
                    </div>
                </div>
             </div>
        </section>
        
        <div className="text-center text-xs text-gray-400">
            Files are processed locally (Excel) or via secure AI endpoint (PDF). No data persists without saving.
        </div>
    </div>
  );
};
