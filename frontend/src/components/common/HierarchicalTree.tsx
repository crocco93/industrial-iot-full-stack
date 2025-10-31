import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Move, 
  RefreshCw,
  Building,
  Factory,
  Cpu,
  Zap,
  Activity,
  Settings
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface TreeNode {
  id: string;
  name: string;
  type: 'location' | 'area' | 'device' | 'data_point';
  parent_id?: string;
  children: TreeNode[];
  status?: string;
  online?: boolean;
  device_type?: 'infrastructure' | 'production';
  protocol_type?: string;
  current_value?: any;
  unit?: string;
  last_read?: string;
  metadata?: Record<string, any>;
}

interface HierarchicalTreeProps {
  onNodeSelect?: (node: TreeNode) => void;
  onNodeEdit?: (node: TreeNode) => void;
  onNodeDelete?: (node: TreeNode) => void;
  onNodeMove?: (nodeId: string, newParentId: string) => void;
  allowEdit?: boolean;
  allowDragDrop?: boolean;
  showAddButtons?: boolean;
}

export function HierarchicalTree({ 
  onNodeSelect, 
  onNodeEdit, 
  onNodeDelete, 
  onNodeMove,
  allowEdit = true,
  allowDragDrop = true,
  showAddButtons = true
}: HierarchicalTreeProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTreeData();
  }, []);

  const loadTreeData = async () => {
    try {
      // Load all data
      const [devicesResponse, dataPointsResponse] = await Promise.all([
        api.get('/api/devices/tree?include_data_points=true'),
        api.get('/api/data-points')
      ]);
      
      const devices = devicesResponse.data || [];
      const dataPoints = dataPointsResponse.data || [];
      
      // Build hierarchical structure
      const tree = buildHierarchy(devices, dataPoints);
      setTreeData(tree);
      
      // Auto-expand first level
      const firstLevelIds = tree.map(node => node.id);
      setExpandedNodes(new Set(firstLevelIds));
      
    } catch (error) {
      console.error('Error loading tree data:', error);
      toast({
        title: "Error",
        description: "Failed to load device hierarchy",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (devices: any[], dataPoints: any[]): TreeNode[] => {
    // Group by location, then area, then device
    const locationMap = new Map<string, TreeNode>();
    const areaMap = new Map<string, TreeNode>();
    const deviceMap = new Map<string, TreeNode>();
    
    // Create location nodes
    devices.forEach(device => {
      const locationId = device.location_id || 'default_location';
      const locationName = device.location_id || 'Default Location';
      
      if (!locationMap.has(locationId)) {
        locationMap.set(locationId, {
          id: locationId,
          name: locationName,
          type: 'location',
          children: [],
          metadata: { device_count: 0 }
        });
      }
    });
    
    // Create area nodes
    devices.forEach(device => {
      const locationId = device.location_id || 'default_location';
      const areaId = device.area_id || 'default_area';
      const areaName = device.area_id || 'Default Area';
      
      const areaKey = `${locationId}_${areaId}`;
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          id: areaKey,
          name: areaName,
          type: 'area',
          parent_id: locationId,
          children: [],
          metadata: { location_id: locationId, area_id: areaId, device_count: 0 }
        });
        
        // Add area to location
        const location = locationMap.get(locationId);
        if (location) {
          location.children.push(areaMap.get(areaKey)!);
        }
      }
    });
    
    // Create device nodes
    devices.forEach(device => {
      const locationId = device.location_id || 'default_location';
      const areaId = device.area_id || 'default_area';
      const areaKey = `${locationId}_${areaId}`;
      
      // Get device data points
      const deviceDataPoints = device.children || [];
      const dataPointNodes: TreeNode[] = deviceDataPoints.map((dp: any) => ({
        id: dp.id,
        name: dp.name,
        type: 'data_point' as const,
        parent_id: device.id,
        children: [],
        current_value: dp.current_value,
        unit: dp.unit,
        last_read: dp.last_read,
        metadata: {
          address: dp.address,
          data_type: dp.data_type
        }
      }));
      
      const deviceNode: TreeNode = {
        id: device.id,
        name: device.name,
        type: 'device',
        parent_id: areaKey,
        children: dataPointNodes,
        status: device.status,
        online: device.online,
        device_type: device.device_type,
        protocol_type: device.metadata?.protocol_type,
        metadata: {
          vendor: device.metadata?.vendor,
          model: device.metadata?.model,
          address: device.metadata?.address,
          reliability: device.metadata?.reliability
        }
      };
      
      // Add device to area
      const area = areaMap.get(areaKey);
      if (area) {
        area.children.push(deviceNode);
        area.metadata!.device_count++;
      }
      
      // Update location device count
      const location = locationMap.get(locationId);
      if (location) {
        location.metadata!.device_count++;
      }
    });
    
    return Array.from(locationMap.values());
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    if (!allowDragDrop || node.type === 'location') return;
    
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
  };

  const handleDragOver = (e: React.DragEvent, node: TreeNode) => {
    if (!allowDragDrop || !draggedNode) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only allow dropping on compatible parents
    const canDrop = (
      (draggedNode.type === 'area' && node.type === 'location') ||
      (draggedNode.type === 'device' && node.type === 'area') ||
      (draggedNode.type === 'data_point' && node.type === 'device')
    );
    
    if (canDrop && node.id !== draggedNode.parent_id) {
      setDragOverNode(node.id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetNode: TreeNode) => {
    if (!allowDragDrop || !draggedNode || !onNodeMove) return;
    
    e.preventDefault();
    setDragOverNode(null);
    
    if (targetNode.id === draggedNode.parent_id) return;
    
    try {
      await onNodeMove(draggedNode.id, targetNode.id);
      await loadTreeData();
      
      toast({
        title: "Node Moved",
        description: `${draggedNode.name} moved to ${targetNode.name}`
      });
    } catch (error) {
      toast({
        title: "Move Failed",
        description: "Failed to move node",
        variant: "destructive"
      });
    } finally {
      setDraggedNode(null);
    }
  };

  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case 'location':
        return <Building className="h-4 w-4 text-blue-600" />;
      case 'area':
        return <Factory className="h-4 w-4 text-green-600" />;
      case 'device':
        if (node.device_type === 'infrastructure') {
          return <Zap className="h-4 w-4 text-purple-600" />;
        }
        return <Cpu className="h-4 w-4 text-orange-600" />;
      case 'data_point':
        return <Activity className="h-4 w-4 text-gray-600" />;
      default:
        return <Settings className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (node: TreeNode) => {
    if (node.type === 'device') {
      if (node.online && node.status === 'active') {
        return <Badge className="bg-green-100 text-green-800 text-xs">Online</Badge>;
      }
      if (node.status === 'error') {
        return <Badge className="bg-red-100 text-red-800 text-xs">Error</Badge>;
      }
      return <Badge className="bg-gray-100 text-gray-800 text-xs">Offline</Badge>;
    }
    return null;
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isDragOver = dragOverNode === node.id;
    
    // Filter children based on search
    const filteredChildren = node.children.filter(child => 
      child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      child.children.some(grandChild => 
        grandChild.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    
    return (
      <div key={node.id}>
        <div 
          className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
            isDragOver ? 'bg-blue-50 border-2 border-blue-300' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          draggable={allowDragDrop && node.type !== 'location'}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          onDragLeave={() => setDragOverNode(null)}
          onClick={() => onNodeSelect?.(node)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? 
                <ChevronDown className="h-3 w-3" /> : 
                <ChevronRight className="h-3 w-3" />
              }
            </Button>
          ) : (
            <div className="w-6" />
          )}
          
          {/* Node Icon */}
          {getNodeIcon(node)}
          
          {/* Node Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm truncate">{node.name}</span>
              {getStatusBadge(node)}
              
              {node.type === 'location' && (
                <Badge variant="secondary" className="text-xs">
                  {node.metadata?.device_count || 0} devices
                </Badge>
              )}
              
              {node.type === 'area' && (
                <Badge variant="secondary" className="text-xs">
                  {node.children.length} devices
                </Badge>
              )}
              
              {node.type === 'device' && node.protocol_type && (
                <Badge variant="outline" className="text-xs">
                  {node.protocol_type}
                </Badge>
              )}
              
              {node.type === 'data_point' && node.current_value !== undefined && (
                <Badge variant="outline" className="text-xs font-mono">
                  {node.current_value} {node.unit}
                </Badge>
              )}
            </div>
            
            {/* Additional info */}
            {node.type === 'device' && node.metadata && (
              <div className="text-xs text-gray-500 mt-1">
                {node.metadata.vendor && node.metadata.model && (
                  <span>{node.metadata.vendor} {node.metadata.model}</span>
                )}
                {node.metadata.address && (
                  <span className="ml-2">• {node.metadata.address}</span>
                )}
                {node.metadata.reliability && (
                  <span className="ml-2">• {node.metadata.reliability}% reliable</span>
                )}
              </div>
            )}
            
            {node.type === 'data_point' && node.last_read && (
              <div className="text-xs text-gray-500 mt-1">
                Last read: {new Date(node.last_read).toLocaleTimeString()} • {node.metadata?.address}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          {allowEdit && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {showAddButtons && node.type !== 'data_point' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add child node
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeEdit?.(node);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              
              {node.type !== 'location' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeDelete?.(node);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {filteredChildren.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = treeData.filter(node => {
    if (!searchTerm) return true;
    
    const matchesNode = node.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasMatchingChild = node.children.some(child => 
      child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      child.children.some(grandChild => 
        grandChild.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    
    return matchesNode || hasMatchingChild;
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Device Hierarchy</span>
          <div className="flex items-center space-x-2">
            {allowDragDrop && (
              <Badge variant="secondary" className="text-xs">
                <Move className="h-3 w-3 mr-1" />
                Drag & Drop
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={loadTreeData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search devices and data points..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        
        {/* Tree */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-600">Loading hierarchy...</div>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'No matching devices found' : 'No devices configured'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 group">
              {filteredTree.map(node => renderNode(node))}
            </div>
          )}
        </div>
        
        {/* Drag Instructions */}
        {allowDragDrop && filteredTree.length > 0 && (
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
            📝 <strong>Drag & Drop:</strong> Drag devices between areas or data points between devices to reorganize your hierarchy.
          </div>
        )}
      </CardContent>
    </Card>
  );
}