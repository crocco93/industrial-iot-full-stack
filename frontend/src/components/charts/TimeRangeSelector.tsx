import React from 'react';

interface Props {
  selectedRange: string;
  onRangeChange: (range: string) => void;
}

export const TimeRangeSelector: React.FC<Props> = ({ selectedRange, onRangeChange }) => {
  const ranges = [
    { value: '1h', label: '1H', description: '1 Hour' },
    { value: '6h', label: '6H', description: '6 Hours' },
    { value: '24h', label: '24H', description: '24 Hours' },
    { value: '7d', label: '7D', description: '7 Days' },
    { value: '30d', label: '30D', description: '30 Days' },
  ];

  return (
    <div className="flex space-x-1">
      {ranges.map(range => (
        <button
          key={range.value}
          onClick={() => onRangeChange(range.value)}
          title={range.description}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            selectedRange === range.value
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};