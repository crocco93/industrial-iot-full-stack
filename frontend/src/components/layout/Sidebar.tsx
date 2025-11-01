import React, { useState } from 'react';
import { HierarchicalTree } from '@/components/common/HierarchicalTree';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  Settings, 
  Info, 
  Minimize2,
  Maximize2,
  MapPin,
  Building2,
  Cpu,
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TreeNode {
  id: string;
  name: string;
  type: 'location' | 'area' | 'device' | 'data_point';
  description?: string;
  children: TreeNode[];
  status?: string;
  online?: boolean;
  current_value?: any;
  unit?: string;
  device_count?: number;
  active_device_count?: number;
  alert_count?: number;
  metadata?: Record<string, any>;
}

interface SidebarProps {
  onNodeSelect?: (node: TreeNode) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNodeSelect, className }) => {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { toast } = useToast();

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
    console.log('[Sidebar] Selected node:', node);
  };

  const handleNodeEdit = (node: TreeNode) => {
    console.log('[Sidebar] Edit node:', node);
    toast({
      title: "Edit Node",
      description: `Editing ${node.name} - functionality coming soon`
    });
  };

  const handleNodeDelete = (node: TreeNode) => {
    console.log('[Sidebar] Delete node requested:', node);
    toast({
      title: "Delete Requested",
      description: `Delete ${node.name} - confirm in dialog`,
      variant: "destructive"
    });
  };

  const handleNodeMove = async (nodeId: string, newParentId: string | null, newIndex: number) => {
    console.log(`[Sidebar] Move node ${nodeId} to parent ${newParentId} at index ${newIndex}`);
    // The HierarchicalTree component handles the actual API call
    return Promise.resolve();
  };
  
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'location': return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'area': return <Building2 className="h-4 w-4 text-green-600" />;
      case 'device': return <Cpu className="h-4 w-4 text-purple-600" />;
      case 'data_point': return <Database className="h-4 w-4 text-orange-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };
  
  const getStatusColor = (status?: string, online?: boolean) => {
    if (status === 'error') return 'text-red-600';
    if (status === 'warning') return 'text-yellow-600';
    if (online === true) return 'text-green-600';
    if (online === false) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 flex flex-col ${collapsed ? 'w-12' : 'w-80'} ${className || ''}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <Building className="h-5 w-5 text-blue-600" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Industrial IoT</h1>
                <p className="text-xs text-gray-600">System Hierarchy</p>
              </div>
            </div>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0 flex-shrink-0"
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
      {!collapsed ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <HierarchicalTree 
            onNodeSelect={handleNodeSelect}
            onNodeEdit={handleNodeEdit}
            onNodeDelete={handleNodeDelete}
            onNodeMove={handleNodeMove}
            showCounts={true}
            showStatus={true}
            searchable={true}
            collapsible={true}
          />
        </div>
      ) : (
        /* Collapsed State - Just Icon */
        <div className="flex-1 flex flex-col items-center justify-start pt-4">
          <MapPin className="h-6 w-6 text-gray-600 mb-4" />
          <div className="w-px bg-gray-300 flex-1"></div>
        </div>
      )}
      
      {/* Selected Node Details Panel */}
      {!collapsed && selectedNode && (
        <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Selected Node</div>
          
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="space-y-3">
                {/* Node Header */}
                <div className="flex items-center space-x-2">
                  {getNodeIcon(selectedNode.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{selectedNode.name}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {selectedNode.type.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                
                {/* Status and Counts */}
                <div className="flex flex-wrap gap-1">
                  {selectedNode.status && (
                    <Badge 
                      variant={selectedNode.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {selectedNode.status}
                    </Badge>
                  )}
                  
                  {selectedNode.online !== undefined && (
                    <Badge 
                      variant={selectedNode.online ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {selectedNode.online ? 'Online' : 'Offline'}
                    </Badge>
                  )}
                  
                  {selectedNode.device_count !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      🔧 {selectedNode.active_device_count || 0}/{selectedNode.device_count} devices
                    </Badge>
                  )}
                  
                  {selectedNode.alert_count !== undefined && selectedNode.alert_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      🚨 {selectedNode.alert_count} alerts
                    </Badge>
                  )}
                </div>
                
                {/* Current Value (for data points) */}
                {selectedNode.type === 'data_point' && selectedNode.current_value !== undefined && (
                  <div className="p-2 bg-blue-50 rounded border">
                    <div className="text-xs text-gray-600 mb-1">Current Value</div>
                    <div className="font-mono text-lg font-bold text-blue-600">
                      {selectedNode.current_value} {selectedNode.unit}
                    </div>
                  </div>
                )}
                
                {/* Description */}
                {selectedNode.description && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Description</div>
                    <div className="text-xs text-gray-800">{selectedNode.description}</div>
                  </div>
                )}
                
                {/* Metadata */}
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Details</div>
                    <div className="space-y-1">
                      {Object.entries(selectedNode.metadata).map(([key, value]) => {
                        if (value === null || value === undefined || value === '') return null;
                        return (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-gray-600 capitalize">{key.replace('_', ' ')}:</span>
                            <span className="text-gray-800 font-medium truncate ml-2">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-between pt-2 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 px-3 text-xs"
                    onClick={() => handleNodeEdit(selectedNode)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 px-3 text-xs"
                    onClick={() => {
                      // Show more details
                      console.log('[Sidebar] Show details for:', selectedNode);
                    }}
                  >
                    <Info className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Collapsed Footer */}
      {collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-center">
            <Building className="h-6 w-6 text-gray-400 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};