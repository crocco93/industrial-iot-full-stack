import React from 'react';
import type { Device } from '@/types/hierarchy';

interface Props {
  device?: Device;
  deviceType: 'infrastructure' | 'production';
  onSubmit: (data: Partial<Device>) => void;
  onCancel: () => void;
}

export const DeviceForm: React.FC<Props> = ({ device, deviceType, onSubmit, onCancel }) => {
  const getProtocolOptions = () => {
    if (deviceType === 'infrastructure') {
      return [
        { value: 'modbus-tcp', label: 'Modbus TCP (Power meters, Flow meters)' },
        { value: 'mqtt', label: 'MQTT (IoT sensors, Environmental)' },
        { value: 'bacnet', label: 'BACnet (HVAC, Building automation)' },
      ];
    } else {
      return [
        { value: 'modbus-tcp', label: 'Modbus TCP (PLCs, Controllers)' },
        { value: 'opc-ua', label: 'OPC-UA (SCADA, Data historians)' },
        { value: 'ethernet-ip', label: 'EtherNet/IP (Allen-Bradley)' },
        { value: 'profinet', label: 'Profinet (Siemens equipment)' },
        { value: 'canopen', label: 'CANopen (Motor drives)' },
      ];
    }
  };

  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Device Name</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={device?.name}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Protocol</label>
        <select className="w-full border rounded px-3 py-2">
          {getProtocolOptions().map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select className="w-full border rounded px-3 py-2">
          {deviceType === 'infrastructure' ? (
            <>
              <option value="power">Power & Energy</option>
              <option value="hvac">HVAC System</option>
              <option value="utilities">Water & Utilities</option>
              <option value="security">Security System</option>
            </>
          ) : (
            <>
              <option value="control">Control System</option>
              <option value="robotics">Industrial Robotics</option>
              <option value="quality">Quality Control</option>
              <option value="packaging">Packaging System</option>
            </>
          )}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save {deviceType === 'infrastructure' ? 'Infrastructure' : 'Production'} Device
        </button>
      </div>
    </form>
  );
};