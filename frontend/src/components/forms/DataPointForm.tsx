import React from 'react';
import type { DataPoint } from '@/types/hierarchy';
import { ScalingConfig } from './ScalingConfig';

interface Props {
  dataPoint?: DataPoint;
  protocolType: string;
  onSubmit: (data: Partial<DataPoint>) => void;
  onCancel: () => void;
}

export const DataPointForm: React.FC<Props> = ({ dataPoint, protocolType, onSubmit, onCancel }) => {
  const [scaling, setScaling] = React.useState({
    multiplier: dataPoint?.scaling?.multiplier || 1,
    offset: dataPoint?.scaling?.offset || 0
  });

  const getAddressLabel = () => {
    switch (protocolType) {
      case 'modbus-tcp': return 'Register Address (e.g., 40001)';
      case 'opc-ua': return 'Node ID (e.g., ns=2;i=1001)';
      case 'mqtt': return 'Topic (e.g., sensors/temperature)';
      case 'ethernet-ip': return 'Tag Name (e.g., Production.Rate)';
      case 'profinet': return 'DB Address (e.g., DB1.DBD0)';
      case 'canopen': return 'Object Index (e.g., 0x6000)';
      case 'bacnet': return 'Object Instance (e.g., analogInput:1)';
      default: return 'Address';
    }
  };

  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Data Point Name</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={dataPoint?.name}
          placeholder="e.g., Temperature Sensor 1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{getAddressLabel()}</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={dataPoint?.address}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data Type</label>
          <select className="w-full border rounded px-3 py-2">
            <option value="integer">Integer</option>
            <option value="float">Float</option>
            <option value="boolean">Boolean</option>
            <option value="string">String</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unit</label>
          <input 
            type="text" 
            className="w-full border rounded px-3 py-2"
            defaultValue={dataPoint?.unit}
            placeholder="e.g., °C, kW, L/min"
          />
        </div>
      </div>
      
      <ScalingConfig 
        multiplier={scaling.multiplier}
        offset={scaling.offset}
        onMultiplierChange={(val) => setScaling({...scaling, multiplier: val})}
        onOffsetChange={(val) => setScaling({...scaling, offset: val})}
      />
      
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save Data Point
        </button>
      </div>
    </form>
  );
};