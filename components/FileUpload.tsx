import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  error: string | null;
  allowedExtensions?: string[]; // e.g. ['.xlsx', '.xls'] or ['.pdf']
  label?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  isProcessing, 
  error, 
  allowedExtensions = ['.xlsx', '.xls'],
  label = 'Upload File'
}) => {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isProcessing) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (allowedExtensions.includes(ext)) {
        onFileSelect(file);
      } else {
        alert(`Please upload a valid file (${allowedExtensions.join(', ')})`);
      }
    }
  }, [onFileSelect, isProcessing, allowedExtensions]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const isPdf = allowedExtensions.some(ext => ext.includes('pdf'));

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
          ${isProcessing ? 'bg-gray-50 border-gray-300 cursor-wait' : 'hover:border-blue-500 hover:bg-blue-50 border-gray-300 bg-white cursor-pointer'}
        `}
      >
        <input
          type="file"
          accept={allowedExtensions.join(', ')}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full ${isProcessing ? 'bg-gray-100' : 'bg-blue-100'}`}>
            {isProcessing ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            ) : (
              isPdf ? <FileText className="w-8 h-8 text-blue-600" /> : <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {isProcessing ? 'Processing...' : label}
            </h3>
            <p className="text-sm text-gray-500">
              Drag and drop your file here, or click to browse.
            </p>
            <p className="text-xs text-gray-400">
              Supports {allowedExtensions.join(', ')} formats
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
