import React from 'react';
import type { Device } from '@/types/hierarchy';

interface Props {
  device: Device;
  type: 'infrastructure' | 'production';
}

export const DeviceNode: React.FC<Props> = ({ device, type }) => {
  const icon = type === 'infrastructure' ? '🔌' : '📱';
  
  return (
    <div className="flex items-center text-sm text-gray-600 py-1">
      {icon} {device.name} 
      <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
        {device.protocol_type}
      </span>
    </div>
  );
};