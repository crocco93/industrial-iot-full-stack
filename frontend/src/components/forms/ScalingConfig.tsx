import React from 'react';

interface Props {
  multiplier: number;
  offset: number;
  onMultiplierChange: (value: number) => void;
  onOffsetChange: (value: number) => void;
}

export const ScalingConfig: React.FC<Props> = ({ 
  multiplier, 
  offset, 
  onMultiplierChange, 
  onOffsetChange 
}) => {
  const [rawValue, setRawValue] = React.useState(100);
  const scaledValue = (rawValue * multiplier) + offset;

  return (
    <div className="space-y-4 p-4 border rounded bg-gray-50">
      <h3 className="font-medium text-gray-800">Data Scaling Configuration</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Multiplier</label>
          <input 
            type="number" 
            step="0.01"
            className="w-full border rounded px-3 py-2"
            value={multiplier}
            onChange={(e) => onMultiplierChange(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Offset</label>
          <input 
            type="number" 
            step="0.01"
            className="w-full border rounded px-3 py-2"
            value={offset}
            onChange={(e) => onOffsetChange(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
      
      <div className="bg-white p-3 rounded border">
        <h4 className="text-sm font-medium mb-2">Formula Preview</h4>
        <div className="text-sm text-gray-600 mb-2">
          Scaled Value = (Raw Value × {multiplier}) + {offset}
        </div>
        
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-xs text-gray-500">Test Raw Value:</label>
            <input 
              type="number"
              className="w-20 border rounded px-2 py-1 text-sm"
              value={rawValue}
              onChange={(e) => setRawValue(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="text-lg">→</div>
          <div>
            <span className="block text-xs text-gray-500">Scaled Result:</span>
            <span className="font-semibold text-blue-600">{scaledValue.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};