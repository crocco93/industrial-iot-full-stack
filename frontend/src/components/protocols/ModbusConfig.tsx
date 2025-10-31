import React from 'react';

interface ModbusConfig {
  host: string;
  port: number;
  unit_id: number;
  timeout?: number;
}

interface Props {
  config: ModbusConfig;
  onChange: (config: ModbusConfig) => void;
}

export const ModbusConfig: React.FC<Props> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Modbus TCP Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: PLCs, Power meters, Flow meters, Industrial controllers
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Host / IP Address</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          value={config.host}
          onChange={(e) => onChange({ ...config, host: e.target.value })}
          placeholder="192.168.1.100"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Port</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            value={config.port}
            onChange={(e) => onChange({ ...config, port: parseInt(e.target.value) || 502 })}
            placeholder="502"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unit ID</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            value={config.unit_id}
            onChange={(e) => onChange({ ...config, unit_id: parseInt(e.target.value) || 1 })}
            placeholder="1"
            min="1"
            max="247"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
        <input 
          type="number" 
          className="w-full border rounded px-3 py-2"
          value={config.timeout || 5}
          onChange={(e) => onChange({ ...config, timeout: parseFloat(e.target.value) || 5 })}
          placeholder="5.0"
          step="0.1"
        />
      </div>
      
      <div className="bg-blue-50 p-3 rounded text-sm">
        <strong>Function Codes:</strong> Read Coils (1), Read Inputs (2), Read Holdings (3), Read Input Registers (4), Write Coil (5), Write Register (6)
      </div>
    </div>
  );
};