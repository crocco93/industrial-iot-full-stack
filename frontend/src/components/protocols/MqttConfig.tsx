import React from 'react';

export const MqttConfig: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">MQTT Configuration</h3>
      <div className="text-sm text-gray-600 mb-4">
        Used for: IoT sensors, Environmental monitoring, Utilities, Lightweight messaging
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Broker Host</label>
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
            placeholder="1883"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Keep Alive (s)</label>
          <input 
            type="number" 
            className="w-full border rounded px-3 py-2"
            placeholder="60"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Base Topic</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          placeholder="sensors/temperature"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">QoS Level</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="0">0 - At most once (Fire and forget)</option>
          <option value="1">1 - At least once (Acknowledged delivery)</option>
          <option value="2">2 - Exactly once (Assured delivery)</option>
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
      
      <div className="bg-purple-50 p-3 rounded text-sm">
        <strong>MQTT Topics:</strong> Use wildcards (+) for single level, (#) for multi-level subscription
      </div>
    </div>
  );
};