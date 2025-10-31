import React from 'react';
import { LocationNode } from './LocationNode';
import { useHierarchyStore } from '@/stores/useHierarchyStore';

export const TreeView: React.FC = () => {
  const { locations } = useHierarchyStore();

  return (
    <div className="p-4">
      {locations.map(location => (
        <LocationNode key={location.id} location={location} />
      ))}
    </div>
  );
};