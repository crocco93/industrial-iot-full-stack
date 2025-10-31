import React from 'react';

export const EthernetIpConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">EtherNet/IP Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: Allen-Bradley PLCs, Industrial robots, Rockwell Automation HMIs
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Target Host</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          placeholder="192.168.1.100"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Port</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="44818"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slot</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="0"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">PLC Type</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="logix">Allen-Bradley Logix (ControlLogix, CompactLogix)</option>
          <option value="slc">SLC 500</option>
          <option value="micrologix">MicroLogix</option>
          <option value="plc5">PLC-5</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Connection Size</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="500">500 bytes (Standard)</option>
          <option value="1000">1000 bytes (Large)</option>
          <option value="2000">2000 bytes (Very Large)</option>
        </select>
      </div>
      
      <div className="bg-red-50 p-3 rounded text-sm">
        <strong>Tag Examples:</strong> Production.Rate, Motor[1].Speed, Status.Running, Temperature.Value
      </div>
    </div>
  );
};