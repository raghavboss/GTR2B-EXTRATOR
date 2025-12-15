import React, { useState, useEffect } from 'react';
import { Database, Clock, Trash2, FileText, ChevronRight } from 'lucide-react';
import { getAllReports, deleteReport } from '../utils/db';
import { SavedReport } from '../types';
import { AnalysisView } from '../components/AnalysisView';

export const ReportsModule = () => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);

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

  const handleDeleteReport = async (e: React.MouseEvent | null, id: number) => {
    if (e) e.stopPropagation();
    if (confirm('Are you sure you want to permanently delete this report?')) {
      await deleteReport(id);
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport(null);
      }
      await loadSavedReports();
    }
  };

  // Detailed View
  if (selectedReport) {
    return (
      <AnalysisView 
        data={selectedReport}
        onBack={() => setSelectedReport(null)}
        isSavedMode={true}
        onDelete={() => selectedReport.id && handleDeleteReport(null, selectedReport.id)}
      />
    );
  }

  // List View
  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Saved Reports Library</h1>
        <p className="text-gray-500 mt-2">Browse and analyze your previously processed GSTR-2B files.</p>
      </header>

      {savedReports.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {savedReports.map((report) => (
            <div 
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={(e) => report.id && handleDeleteReport(e, report.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                    title="Delete Report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 truncate mb-1 group-hover:text-blue-700 transition-colors">
                  {report.fileName || 'Untitled Report'}
                </h3>
                <p className="text-sm text-gray-500">
                  ID: #{report.id}
                </p>
              </div>

              <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  {new Date(report.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center font-medium bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                   {report.data.length} invoices
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Database className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved reports found</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Uploaded files that you save will appear here for quick access and analysis.
          </p>
        </div>
      )}
    </div>
  );
};
