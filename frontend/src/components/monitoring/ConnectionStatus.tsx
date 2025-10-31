import React from 'react';

export const ConnectionStatus: React.FC = () => {
  const devices = [
    { name: 'Main Power Meter', type: 'infrastructure', protocol: 'Modbus TCP', status: 'connected', lastSeen: '2 min ago' },
    { name: 'HVAC Central Unit', type: 'infrastructure', protocol: 'BACnet', status: 'connected', lastSeen: '1 min ago' },
    { name: 'Water Flow Monitor', type: 'infrastructure', protocol: 'MQTT', status: 'disconnected', lastSeen: '15 min ago' },
    { name: 'Assembly Line PLC', type: 'production', protocol: 'Modbus TCP', status: 'connected', lastSeen: '30 sec ago' },
    { name: 'Welding Robot #1', type: 'production', protocol: 'EtherNet/IP', status: 'connected', lastSeen: '45 sec ago' },
    { name: 'Quality Scanner', type: 'production', protocol: 'OPC-UA', status: 'connected', lastSeen: '1 min ago' },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Device Connections</h3>
      <div className="space-y-3 max-h-64 overflow-auto">
        {devices.map((device, index) => (
          <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
            <div>
              <div className="font-medium">{device.name}</div>
              <div className="text-sm text-gray-500">
                {device.type === 'infrastructure' ? '🔌' : '📱'} {device.protocol}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">{device.lastSeen}</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                device.status === 'connected' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {device.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};