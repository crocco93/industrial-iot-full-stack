import React, { useState } from 'react';
import { SystemDashboard } from '@/components/monitoring/SystemDashboard';

export const TabNavigation: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SystemDashboard />;
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
        </nav>
      </div>
      <div className="flex-1 p-6">
        {renderContent()}
      </div>
    </div>
  );
};