import React from 'react';

export const CanopenConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">CANopen Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: Motor drives, Motion controllers, Distributed I/O, Industrial buses
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">CAN Interface</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="can0">can0 (Primary CAN interface)</option>
          <option value="can1">can1 (Secondary CAN interface)</option>
          <option value="vcan0">vcan0 (Virtual CAN - Testing)</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Baud Rate</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="125000">125 kbps</option>
          <option value="250000">250 kbps (Most common)</option>
          <option value="500000">500 kbps</option>
          <option value="1000000">1 Mbps</option>
        </select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Node ID</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="2"
            min="1"
            max="127"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Heartbeat (ms)</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="1000"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">EDS File</label>
        <input 
          type="file" 
          accept=".eds"
          className="w-full border rounded px-3 py-2"
        />
        <div className="text-xs text-gray-500 mt-1">
          Electronic Data Sheet for device-specific object dictionary
        </div>
      </div>
      
      <div className="bg-orange-50 p-3 rounded text-sm">
        <strong>Communication Objects:</strong> SDO (Service Data Objects), PDO (Process Data Objects), Emergency, Sync
      </div>
    </div>
  );
};