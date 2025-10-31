import React from 'react';

export const OpcUaConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">OPC-UA Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: SCADA systems, Data historians, Industrial PCs, Complex automation
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Endpoint URL</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          placeholder="opc.tcp://192.168.1.100:4840"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Security Mode</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="None">None (No security)</option>
          <option value="Sign">Sign (Message signing)</option>
          <option value="SignAndEncrypt">Sign & Encrypt (Full security)</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Security Policy</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="None">None</option>
          <option value="Basic128Rsa15">Basic128Rsa15</option>
          <option value="Basic256">Basic256</option>
          <option value="Basic256Sha256">Basic256Sha256</option>
        </select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input 
            type="text" 
            className="w-full border rounded px-3 py-2"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input 
            type="password" 
            className="w-full border rounded px-3 py-2"
            placeholder="Optional"
          />
        </div>
      </div>
      
      <div className="bg-green-50 p-3 rounded text-sm">
        <strong>Features:</strong> Auto node discovery, Complex data types, Built-in security, Historical access
      </div>
    </div>
  );
};