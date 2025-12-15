import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, ArrowLeft, Trash2, Layers } from 'lucide-react';
import DataTable from './DataTable';
import AiAssistant from './AiAssistant';
import { ExtractionResult } from '../types';

interface AnalysisViewProps {
  data: ExtractionResult | ExtractionResult[];
  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  isSavedMode?: boolean; // true if viewing a saved report, false if new extraction
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ 
  data, 
  onBack, 
  onSave, 
  onDelete,
  isSaving = false, 
  saveSuccess = false,
  isSavedMode = false
}) => {
  // Normalize input to array
  const results = Array.isArray(data) ? data : [data];
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // If data changes, reset index
  useEffect(() => {
    setActiveSheetIndex(0);
  }, [data]);

  const activeResult = results[activeSheetIndex] || results[0];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                        title="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            {activeResult?.fileName || 'Data Report'}
                        </h2>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {isSavedMode ? 'Saved Report' : 'Extraction Complete'} &bull; {activeResult?.data.length} Records
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                     {!isSavedMode && onSave && (
                       <button
                         onClick={onSave}
                         disabled={isSaving || saveSuccess}
                         className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:outline-none transition-all shadow-sm
                           ${saveSuccess 
                             ? 'bg-green-100 text-green-700 border border-green-200' 
                             : 'bg-indigo-600 text-white hover:bg-indigo-700'
                           }`}
                       >
                         {saveSuccess ? (
                           <>
                             <CheckCircle className="w-4 h-4 mr-2" />
                             Saved
                           </>
                         ) : (
                           <>
                             {isSaving ? (
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                             ) : (
                               <Save className="w-4 h-4 mr-2" />
                             )}
                             Save {results.length > 1 ? 'All Sheets' : 'Report'}
                           </>
                         )}
                       </button>
                     )}

                     {isSavedMode && onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Report
                        </button>
                     )}
                </div>
            </div>

            {/* Sheet Tabs - Only show if multiple sheets exist */}
            {results.length > 1 && (
                <div className="flex border-b border-gray-200 overflow-x-auto">
                    {results.map((result, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveSheetIndex(idx)}
                            className={`
                                flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${activeSheetIndex === idx 
                                    ? 'border-blue-500 text-blue-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }
                            `}
                        >
                            <Layers className="w-4 h-4" />
                            {result.sheetName || `Sheet ${idx + 1}`}
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                                {result.data.length}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
             <div className="lg:col-span-2 h-full flex flex-col min-h-[500px]">
                 {activeResult && (
                    <DataTable 
                        headers={activeResult.headers} 
                        data={activeResult.data} 
                        markdown={activeResult.markdown} 
                    />
                 )}
             </div>
             <div className="lg:col-span-1 h-full min-h-[500px]">
                 {activeResult && (
                    <AiAssistant data={activeResult.data} />
                 )}
             </div>
        </div>
    </div>
  );
};
