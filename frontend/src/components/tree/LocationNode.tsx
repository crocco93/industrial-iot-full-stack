import React from 'react';
import { AreaNode } from './AreaNode';
import { DeviceNode } from './DeviceNode';
import type { Location } from '@/types/hierarchy';

interface Props {
  location: Location;
}

export const LocationNode: React.FC<Props> = ({ location }) => {
  return (
    <div className="mb-2">
      <div className="flex items-center font-semibold text-gray-800">
        📍 {location.name}
      </div>
      
      {/* Infrastructure Devices */}
      {location.devices?.map(device => (
        <div key={device.id} className="ml-4">
          <DeviceNode device={device} type="infrastructure" />
        </div>
      ))}
      
      {/* Areas */}
      {location.areas?.map(area => (
        <div key={area.id} className="ml-4">
          <AreaNode area={area} />
        </div>
      ))}
    </div>
  );
};