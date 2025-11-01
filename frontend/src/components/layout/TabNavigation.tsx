import React, { useState } from 'react';
import { SystemDashboard } from '@/components/monitoring/SystemDashboard';
import { ProtocolManager } from '@/components/protocols/ProtocolManager';
import { ConnectionManager } from '@/components/connections/ConnectionManager';
import { DeviceManager } from '@/components/devices/DeviceManager';
import { HistoricalAnalysis } from '@/components/history/HistoricalAnalysis';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { IntegrationManager } from '@/components/integrations/IntegrationManager';
import { BarChart3, Settings, Wifi, Zap, Monitor, Activity, Database } from 'lucide-react';

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
      case 'history':  // ✅ DODANE!
        return <HistoricalAnalysis />;
      case 'integrations':
        return <IntegrationManager />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <SystemDashboard />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Monitor },
    { id: 'protocols', label: 'Protocols', icon: Wifi },
    { id: 'connections', label: 'Connections', icon: Database },
    { id: 'devices', label: 'Devices', icon: Activity },
    { id: 'history', label: 'History', icon: BarChart3 },  // ✅ DODANE!
    { id: 'integrations', label: 'Integrations', icon: Zap },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white shadow-sm">
        <nav className="flex space-x-6 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-3 border-b-2 transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-500 bg-blue-50'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};