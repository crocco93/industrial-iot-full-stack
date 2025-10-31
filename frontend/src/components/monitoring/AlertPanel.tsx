import React from 'react';

export const AlertPanel: React.FC = () => {
  const alerts = [
    { 
      id: 1, 
      type: 'warning', 
      title: 'High Temperature Alert',
      message: 'Temperature in Assembly Line Alpha exceeded 75°C', 
      time: '5 min ago',
      device: 'Temperature Sensor #3'
    },
    { 
      id: 2, 
      type: 'error', 
      title: 'Connection Lost',
      message: 'Lost connection to Water Flow Monitor', 
      time: '15 min ago',
      device: 'Water Monitor #1'
    },
    { 
      id: 3, 
      type: 'info', 
      title: 'Maintenance Due',
      message: 'Scheduled maintenance for Welding Robot #1 due in 2 days', 
      time: '1 hour ago',
      device: 'Welding Robot #1'
    },
  ];

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-400 bg-red-50';
      case 'warning': return 'border-yellow-400 bg-yellow-50';
      case 'info': return 'border-blue-400 bg-blue-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '⚠️';
      case 'warning': return '🟡';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">System Alerts</h3>
      <div className="space-y-3 max-h-64 overflow-auto">
        {alerts.map(alert => (
          <div key={alert.id} className={`flex items-start space-x-3 p-3 rounded border-l-4 ${getAlertColor(alert.type)}`}>
            <div className="text-lg">{getAlertIcon(alert.type)}</div>
            <div className="flex-1">
              <div className="font-medium text-sm">{alert.title}</div>
              <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">{alert.device}</span>
                <span className="text-xs text-gray-500">{alert.time}</span>
              </div>
            </div>
            <button className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border">
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};