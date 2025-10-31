import React, { useState } from 'react';
import { SystemDashboard } from '@/components/monitoring/SystemDashboard';
import { ProtocolManager } from '@/components/protocols/ProtocolManager';
import { ConnectionManager } from '@/components/connections/ConnectionManager';
import { DeviceManager } from '@/components/devices/DeviceManager';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { IntegrationManager } from '@/components/integrations/IntegrationManager';

export const TabNavigation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SystemDashboard />;
      case 'protocols':
        return <ProtocolManager />;
      case 'connections':
        return <ConnectionManager />;
      case 'devices':
        return <DeviceManager />;
      case 'integrations':
        return <IntegrationManager />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <SystemDashboard />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'protocols', label: 'Protocols' },
    { id: 'connections', label: 'Connections' },
    { id: 'devices', label: 'Devices' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'settings', label: 'Settings' }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 p-6">
        {renderContent()}
      </div>
    </div>
  );
};