import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText } from 'lucide-react';

/**
 * PDF upload modal with drag-and-drop support via react-dropzone.
 */
export default function PdfUploader({ isOpen, onClose, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadStatus('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadStatus('Uploading and processing...');

    try {
      const result = await onUpload(selectedFile);
      if (result && result.success) {
        setUploadStatus('Upload successful!');
        setTimeout(() => {
          setSelectedFile(null);
          setUploadStatus('');
        }, 1000);
      } else {
        setUploadStatus('Upload failed. Please try again.');
      }
    } catch (err) {
      setUploadStatus('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setUploadStatus('');
      onClose();
    }
  };

  // Format file size for display
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative animate-message-fade-in">
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={uploading}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-6">
          <Upload className="w-6 h-6 text-indigo-400" />
          <h3 className="text-xl font-semibold text-white">
            Upload PDF Document
          </h3>
        </div>

        {/* Drag & drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-950/20'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
          }`}
        >
          <input {...getInputProps()} />
          <FileText
            className={`w-10 h-10 mx-auto mb-3 ${
              isDragActive ? 'text-indigo-400' : 'text-gray-500'
            }`}
          />
          <p className="text-gray-300 font-medium mb-1">
            {isDragActive
              ? 'Drop your PDF here...'
              : 'Drag & drop your PDF here'}
          </p>
          <p className="text-sm text-gray-500">or click to browse</p>
        </div>

        {/* Selected file info */}
        {selectedFile && (
          <div className="mt-4 flex items-center gap-3 bg-gray-800 rounded-lg p-3">
            <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {formatSize(selectedFile.size)}
              </p>
            </div>
          </div>
        )}

        {/* Upload status */}
        {uploadStatus && (
          <p
            className={`mt-3 text-sm text-center ${
              uploadStatus.includes('failed')
                ? 'text-red-400'
                : uploadStatus.includes('successful')
                ? 'text-green-400'
                : 'text-indigo-400'
            }`}
          >
            {uploadStatus}
          </p>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload & Process
            </>
          )}
        </button>
      </div>
    </div>
  );
}
