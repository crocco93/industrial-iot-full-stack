import React, { useState } from 'react';
import { SystemDashboard } from '@/components/monitoring/SystemDashboard';
import { ProtocolManager } from '@/components/protocols/ProtocolManager';  // ← DODAJ!
import { ConnectionManager } from '@/components/connections/ConnectionManager'; // ← DODAJ!
import { DeviceManager } from '@/components/devices/DeviceManager';     // ← DODAJ!
import { SettingsPage } from '@/components/settings/SettingsPage';      // ← DODAJ!

export const TabNavigation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SystemDashboard />;
      case 'protocols':           // ← DODAJ!
        return <ProtocolManager />;
      case 'connections':         // ← DODAJ!
        return <ConnectionManager />;
      case 'devices':             // ← DODAJ!
        return <DeviceManager />;
      case 'settings':            // ← DODAJ!
        return <SettingsPage />;
      default:
        return <SystemDashboard />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white">
        <nav className="flex space-x-8 px-6">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`py-4 ${activeTab === 'overview' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}
          >
            Overview
          </button>
          
          {/* ← DODAJ WSZYSTKIE TABS: */}
          <button 
            onClick={() => setActiveTab('protocols')}
            className={`py-4 ${activeTab === 'protocols' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}
          >
            Protocols
          </button>
          
          <button 
            onClick={() => setActiveTab('connections')}
            className={`py-4 ${activeTab === 'connections' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}
          >
            Connections
          </button>
          
          <button 
            onClick={() => setActiveTab('devices')}
            className={`py-4 ${activeTab === 'devices' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}
          >
            Devices
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`py-4 ${activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}
          >
            Settings
          </button>
        </nav>
      </div>
      <div className="flex-1 p-6">
        {renderContent()}
      </div>
    </div>
  );
};
