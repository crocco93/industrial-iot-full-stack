import React from 'react';
import { TreeView } from '@/components/tree/TreeView';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-80 bg-white shadow-lg">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Industrial IoT</h1>
      </div>
      <TreeView />
    </div>
  );
};