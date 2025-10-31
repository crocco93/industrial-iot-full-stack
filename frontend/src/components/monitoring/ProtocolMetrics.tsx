import React from 'react';

export const ProtocolMetrics: React.FC = () => {
  const protocols = [
    { name: 'Modbus TCP', messages: 125, errors: 2, latency: 8, devices: 8 },
    { name: 'OPC-UA', messages: 89, errors: 0, latency: 15, devices: 4 },
    { name: 'MQTT', messages: 234, errors: 1, latency: 5, devices: 6 },
    { name: 'EtherNet/IP', messages: 67, errors: 0, latency: 12, devices: 3 },
    { name: 'Profinet', messages: 45, errors: 1, latency: 18, devices: 2 },
    { name: 'CANopen', messages: 78, errors: 0, latency: 6, devices: 2 },
    { name: 'BACnet', messages: 23, errors: 0, latency: 22, devices: 1 },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Protocol Performance</h3>
      <div className="space-y-4">
        {protocols.map(protocol => (
          <div key={protocol.name} className="border-b pb-3 last:border-b-0">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{protocol.name}</h4>
              <span className="text-green-600 text-sm flex items-center">
                • Active ({protocol.devices} devices)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Msg/sec:</span>
                <div className="font-semibold">{protocol.messages}</div>
              </div>
              <div>
                <span className="text-gray-500">Errors:</span>
                <div className={`font-semibold ${
                  protocol.errors > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {protocol.errors}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Latency:</span>
                <div className="font-semibold">{protocol.latency}ms</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};