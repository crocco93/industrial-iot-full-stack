import React from 'react';

interface Props {
  onExportCSV: () => void;
  onExportJSON: () => void;
  disabled?: boolean;
}

export const DataExport: React.FC<Props> = ({ onExportCSV, onExportJSON, disabled = false }) => {
  return (
    <div className="flex space-x-2">
      <button 
        onClick={onExportCSV}
        disabled={disabled}
        className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
        title="Export data as CSV file"
      >
        CSV
      </button>
      <button 
        onClick={onExportJSON}
        disabled={disabled}
        className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
        title="Export data as JSON file"
      >
        JSON
      </button>
    </div>
  );
};