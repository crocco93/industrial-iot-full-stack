import React from 'react';
import { DeviceNode } from './DeviceNode';
import type { Area } from '@/types/hierarchy';

interface Props {
  area: Area;
}

export const AreaNode: React.FC<Props> = ({ area }) => {
  return (
    <div className="mb-2">
      <div className="flex items-center font-medium text-gray-700">
        🏭 {area.name}
      </div>
      
      {/* Production Devices */}
      {area.devices?.map(device => (
        <div key={device.id} className="ml-4">
          <DeviceNode device={device} type="production" />
        </div>
      ))}
    </div>
  );
};