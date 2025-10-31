import React from 'react';
import type { Area } from '@/types/hierarchy';

interface Props {
  area?: Area;
  onSubmit: (data: Partial<Area>) => void;
  onCancel: () => void;
}

export const AreaForm: React.FC<Props> = ({ area, onSubmit, onCancel }) => {
  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Area Name</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={area?.name}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea 
          className="w-full border rounded px-3 py-2"
          defaultValue={area?.description}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Area Type</label>
        <select className="w-full border rounded px-3 py-2">
          <option value="production">Production Line</option>
          <option value="assembly">Assembly Area</option>
          <option value="packaging">Packaging Department</option>
          <option value="quality">Quality Control</option>
          <option value="warehouse">Warehouse</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save Area
        </button>
      </div>
    </form>
  );
};