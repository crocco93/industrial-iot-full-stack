import React from 'react';
import { RealTimeGauge } from '@/components/charts/RealTimeGauge';
import { ProtocolMetrics } from './ProtocolMetrics';
import { ConnectionStatus } from './ConnectionStatus';
import { AlertPanel } from './AlertPanel';

export const SystemDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RealTimeGauge 
          value={1250} 
          min={0} 
          max={2000} 
          unit="kW" 
          label="Total Power Consumption" 
        />
        <RealTimeGauge 
          value={22.5} 
          min={15} 
          max={30} 
          unit="°C" 
          label="Building Temperature" 
        />
        <RealTimeGauge 
          value={45} 
          min={0} 
          max={100} 
          unit="L/min" 
          label="Water Flow Rate" 
        />
      </div>
      
      {/* System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Connected Devices:</span>
              <span className="font-semibold text-green-600">24/26</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Active Protocols:</span>
              <span className="font-semibold text-blue-600">7/7</span>
            </div>
            <div className="flex justify-between items-center">
              <span>System Uptime:</span>
              <span className="font-semibold">99.8%</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Data Points:</span>
              <span className="font-semibold">156 active</span>
            </div>
          </div>
        </div>
        
        <ProtocolMetrics />
      </div>
      
      {/* Detailed Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectionStatus />
        <AlertPanel />
      </div>
    </div>
  );
};