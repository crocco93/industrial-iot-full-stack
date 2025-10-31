import React from 'react';

export const BacnetConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">BACnet Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: HVAC systems, Building management, Energy monitoring, Climate control
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Device ID</label>
        <input 
          type="number" 
          className="w-full border rounded px-3 py-2"
          placeholder="12345"
          min="0"
          max="4194303"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Local Address</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          placeholder="192.168.1.100/24"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">UDP Port</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="47808"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max APDU Length</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="1024"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Segmentation Support</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="segmentedBoth">Both (Transmit & Receive)</option>
          <option value="segmentedTransmit">Transmit Only</option>
          <option value="segmentedReceive">Receive Only</option>
          <option value="noSegmentation">No Segmentation</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Object Types to Read</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            Analog Input
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            Analog Output
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            Binary Input
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" />
            Binary Output
          </label>
        </div>
      </div>
      
      <div className="bg-indigo-50 p-3 rounded text-sm">
        <strong>Object Naming:</strong> analogInput:0, analogOutput:1, binaryInput:2, device:12345
      </div>
    </div>
  );
};