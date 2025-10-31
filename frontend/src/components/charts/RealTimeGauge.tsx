import React from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  unit: string;
  label: string;
}

export const RealTimeGauge: React.FC<Props> = ({ value, min, max, unit, label }) => {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  
  const getColor = () => {
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h4 className="font-medium mb-2 text-gray-700">{label}</h4>
      
      <div className="text-3xl font-bold mb-4">
        {value.toLocaleString()} 
        <span className="text-lg text-gray-500 font-normal">{unit}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div 
          className={`h-3 rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between text-sm text-gray-500">
        <span>{min}</span>
        <span className="font-medium">{percentage.toFixed(1)}%</span>
        <span>{max}</span>
      </div>
      
      {/* Status indicator */}
      <div className="mt-3 flex items-center text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
        <span className="text-gray-600">Live data</span>
        <span className="ml-auto text-xs text-gray-500">
          Updated {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};