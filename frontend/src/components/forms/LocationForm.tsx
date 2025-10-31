import React from 'react';
import type { Location } from '@/types/hierarchy';

interface Props {
  location?: Location;
  onSubmit: (data: Partial<Location>) => void;
  onCancel: () => void;
}

export const LocationForm: React.FC<Props> = ({ location, onCancel }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation needed
    console.log('Form submitted');
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium mb-1">Location Name</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={location?.name}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea 
          className="w-full border rounded px-3 py-2"
          defaultValue={location?.description}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Address</label>
        <input 
          type="text" 
          className="w-full border rounded px-3 py-2"
          defaultValue={location?.address}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save Location
        </button>
      </div>
    </form>
  );
};