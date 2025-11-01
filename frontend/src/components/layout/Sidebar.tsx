import React, { useState } from 'react';
import { HierarchicalTree } from '@/components/common/HierarchicalTree';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  Settings, 
  Info, 
  Minimize2,
  Maximize2
} from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  type: 'location' | 'area' | 'device' | 'data_point';
  children: TreeNode[];
  status?: string;
  online?: boolean;
  current_value?: any;
  unit?: string;
}

export const Sidebar: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    console.log('Selected node:', node);
  };

  const handleNodeEdit = (node: TreeNode) => {
    console.log('Edit node:', node);
    // TODO: Open edit dialog
  };

  const handleNodeDelete = (node: TreeNode) => {
    if (confirm(`Czy na pewno chcesz usunąć "${node.name}"?`)) {
      console.log('Delete node:', node);
      // TODO: Implement delete
    }
  };

  const handleNodeMove = async (nodeId: string, newParentId: string) => {
    console.log(`Move node ${nodeId} to parent ${newParentId}`);
    // TODO: Implement move via API
    return Promise.resolve();
  };

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">Industrial IoT</h1>
              <p className="text-xs text-gray-600">Device Management</p>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0"
          >
            {collapsed ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Tree Content */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          <div className="h-full">
            <HierarchicalTree 
              onNodeSelect={handleNodeSelect}
              onNodeEdit={handleNodeEdit}
              onNodeDelete={handleNodeDelete}
              onNodeMove={handleNodeMove}
              allowEdit={true}
              allowDragDrop={true}
              showAddButtons={true}
            />
          </div>
        </div>
      )}
      
      {/* Selected Node Info */}
      {!collapsed && selectedNode && (
        <div className="border-t border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-2">SELECTED NODE</div>
          <Card className="p-3">
            <div className="space-y-2">
              <div className="font-medium text-sm truncate">{selectedNode.name}</div>
              <div className="text-xs text-gray-500 capitalize">
                Type: {selectedNode.type.replace('_', ' ')}
              </div>
              
              {selectedNode.type === 'device' && (
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedNode.online ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs">
                    {selectedNode.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              )}
              
              {selectedNode.type === 'data_point' && selectedNode.current_value !== undefined && (
                <div className="text-xs">
                  <span className="font-mono">{selectedNode.current_value} {selectedNode.unit}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-1 pt-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  Details
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Config
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Collapsed State Icon */}
      {collapsed && (
        <div className="p-4">
          <Building className="h-6 w-6 text-gray-600 mx-auto" />
        </div>
      )}
    </div>
  );
};