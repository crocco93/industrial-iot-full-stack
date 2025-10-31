import React from 'react';

export const ProfinetConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Profinet Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: Siemens equipment, Industrial Ethernet, Motor drives, Distributed I/O
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">IP Address</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          placeholder="192.168.1.100"
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Port</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="102"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rack</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slot</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="1"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Connection Type</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="pg">PG (Programming Device)</option>
          <option value="op">OP (Operator Panel)</option>
          <option value="basic">Basic (Standard connection)</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Data Areas Access</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            DB (Data Blocks)
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            MK (Memory bits)
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            PE (Process inputs)
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            PA (Process outputs)
          </label>
        </div>
      </div>
      
      <div className="bg-yellow-50 p-3 rounded text-sm">
        <strong>Address Format:</strong> DB1.DBD0 (DB block 1, Double word 0), MW10 (Memory word 10)
      </div>
    </div>
  );
};