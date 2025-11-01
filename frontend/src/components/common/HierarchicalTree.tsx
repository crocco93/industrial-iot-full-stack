import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  MapPin, 
  Building2, 
  Cpu, 
  Database,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface TreeNode {
  id: string;
  name: string;
  type: 'location' | 'area' | 'device' | 'data_point';
  description?: string;
  parent_id?: string;
  status?: 'active' | 'inactive' | 'error' | 'warning';
  children: TreeNode[];
  device_count?: number;
  active_device_count?: number;
  alert_count?: number;
  metadata?: Record<string, any>;
  order_index?: number;
}

interface HierarchicalTreeProps {
  collapsible?: boolean;
  onNodeSelect?: (node: TreeNode) => void;
  onNodeEdit?: (node: TreeNode) => void;
  onNodeDelete?: (node: TreeNode) => void;
  onNodeMove?: (nodeId: string, newParentId: string | null, newIndex: number) => void;
  showCounts?: boolean;
  showStatus?: boolean;
  searchable?: boolean;
}

interface AddNodeDialogProps {
  open: boolean;
  onClose: () => void;
  parentId?: string;
  nodeType: 'location' | 'area';
  onSuccess: () => void;
}

function AddNodeDialog({ open, onClose, parentId, nodeType, onSuccess }: AddNodeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    manager: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/api/locations', {
        name: formData.name,
        description: formData.description,
        type: nodeType,
        parent_id: parentId || null,
        address: formData.address,
        metadata: {
          manager: formData.manager
        }
      });
      
      toast({
        title: "Success",
        description: `${nodeType === 'location' ? 'Location' : 'Area'} created successfully`
      });
      
      onSuccess();
      onClose();
      setFormData({ name: '', description: '', address: '', manager: '' });
      
    } catch (error: any) {
      console.error('Error creating node:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || `Failed to create ${nodeType}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add New {nodeType === 'location' ? 'Location' : 'Area'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={nodeType === 'location' ? 'Factory name' : 'Area name'}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description..."
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Physical address"
            />
          </div>
          
          <div>
            <Label htmlFor="manager">Manager</Label>
            <Input
              id="manager"
              value={formData.manager}
              onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
              placeholder="Responsible person"
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const HierarchicalTree: React.FC<HierarchicalTreeProps> = ({
  collapsible = true,
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onNodeMove,
  showCounts = true,
  showStatus = true,
  searchable = true
}) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogConfig, setAddDialogConfig] = useState<{
    parentId?: string;
    nodeType: 'location' | 'area';
  }>({ nodeType: 'location' });
  
  const { toast } = useToast();

  useEffect(() => {
    loadTreeData();
  }, []);

  const loadTreeData = async () => {
    try {
      setLoading(true);
      
      // Load locations/areas first
      const locationsResponse = await api.get('/api/locations/tree');
      const locations = locationsResponse.data || [];
      
      if (locations.length === 0) {
        // Create sample locations if none exist
        await createSampleLocations();
        const retryResponse = await api.get('/api/locations/tree');
        const enrichedTree = await enrichTreeWithDevices(retryResponse.data || []);
        setTreeData(enrichedTree);
      } else {
        // Enrich with devices and data points
        const enrichedTree = await enrichTreeWithDevices(locations);
        setTreeData(enrichedTree);
      }
      
      // Auto-expand root nodes
      const rootIds = (locations.length > 0 ? locations : treeData).map((node: TreeNode) => node.id);
      setExpandedNodes(new Set(rootIds));
      
    } catch (error) {
      console.error('Error loading tree data:', error);
      toast({
        title: "Loading Error",
        description: "Failed to load hierarchy tree",
        variant: "destructive"
      });
      
      // Fallback to sample data
      setTreeData(getSampleTreeData());
    } finally {
      setLoading(false);
    }
  };
  
  const createSampleLocations = async () => {
    try {
      // Create main factory location
      const factoryResponse = await api.post('/api/locations', {
        name: 'Main Factory',
        description: 'Primary manufacturing facility',
        type: 'location',
        address: 'Industrial District, Warsaw',
        metadata: {
          manager: 'Production Manager',
          coordinates: { lat: 52.2297, lng: 21.0122 }
        }
      });
      
      const factoryId = factoryResponse.data.id;
      
      // Create areas within factory
      await Promise.all([
        api.post('/api/locations', {
          name: 'Production Floor A',
          description: 'Main production line',
          type: 'area',
          parent_id: factoryId,
          metadata: { manager: 'Floor Supervisor A' }
        }),
        api.post('/api/locations', {
          name: 'Production Floor B',
          description: 'Secondary production line',
          type: 'area',
          parent_id: factoryId,
          metadata: { manager: 'Floor Supervisor B' }
        }),
        api.post('/api/locations', {
          name: 'Quality Control',
          description: 'Quality assurance and testing',
          type: 'area',
          parent_id: factoryId,
          metadata: { manager: 'QC Manager' }
        })
      ]);
      
    } catch (error) {
      console.error('Error creating sample locations:', error);
    }
  };
  
  const enrichTreeWithDevices = async (locations: TreeNode[]): Promise<TreeNode[]> => {
    try {
      // Get all devices
      const devicesResponse = await api.get('/api/devices');
      const devices = devicesResponse.data || [];
      
      // Get all data points
      const dataPointsResponse = await api.get('/api/data-points');
      const dataPoints = dataPointsResponse.data || [];
      
      // Build device nodes with data points
      const deviceNodes: Record<string, TreeNode[]> = {};
      
      devices.forEach((device: any) => {
        const deviceDataPoints = dataPoints
          .filter((dp: any) => dp.device_id === device.id)
          .map((dp: any) => ({
            id: dp.id,
            name: dp.name,
            type: 'data_point' as const,
            description: `${dp.data_type} - ${dp.unit || 'N/A'}`,
            parent_id: device.id,
            status: dp.status,
            children: [],
            metadata: {
              value: dp.current_value,
              unit: dp.unit,
              data_type: dp.data_type,
              address: dp.address
            }
          }));
        
        const deviceNode: TreeNode = {
          id: device.id,
          name: device.name,
          type: 'device',
          description: device.description,
          parent_id: device.location_id || device.area_id,
          status: device.status,
          children: deviceDataPoints
        };
        
        const parentKey = device.location_id || device.area_id || 'orphaned';
        if (!deviceNodes[parentKey]) {
          deviceNodes[parentKey] = [];
        }
        deviceNodes[parentKey].push(deviceNode);
      });
      
      // Merge devices into location tree
      const mergeDevicesIntoTree = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(node => {
          const nodeDevices = deviceNodes[node.id] || [];
          const enrichedChildren = node.children.length > 0 
            ? mergeDevicesIntoTree(node.children)
            : [];
          
          return {
            ...node,
            children: [...enrichedChildren, ...nodeDevices],
            device_count: (node.device_count || 0) + nodeDevices.length,
            active_device_count: (node.active_device_count || 0) + nodeDevices.filter(d => d.status === 'active').length
          };
        });
      };
      
      return mergeDevicesIntoTree(locations);
      
    } catch (error) {
      console.error('Error enriching tree with devices:', error);
      return locations;
    }
  };
  
  const getSampleTreeData = (): TreeNode[] => {
    return [
      {
        id: 'loc_factory_001',
        name: 'Main Factory',
        type: 'location',
        description: 'Primary manufacturing facility',
        status: 'active',
        device_count: 12,
        active_device_count: 10,
        alert_count: 2,
        children: [
          {
            id: 'area_production_001',
            name: 'Production Floor A',
            type: 'area',
            parent_id: 'loc_factory_001',
            status: 'active',
            device_count: 6,
            active_device_count: 5,
            alert_count: 1,
            children: []
          },
          {
            id: 'area_production_002',
            name: 'Production Floor B', 
            type: 'area',
            parent_id: 'loc_factory_001',
            status: 'active',
            device_count: 4,
            active_device_count: 3,
            alert_count: 0,
            children: []
          }
        ]
      }
    ];
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

  const selectNode = (node: TreeNode) => {
    setSelectedNode(node.id);
    onNodeSelect?.(node);
  };

  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    if (node.type === 'device' || node.type === 'data_point') return; // Only allow location/area moves
    
    setDraggedNode(node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetNodeId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    
    if (!draggedNode || draggedNode === targetNodeId) {
      setDraggedNode(null);
      setDropTarget(null);
      return;
    }

    try {
      // Find target node
      const targetNode = findNodeInTree(treeData, targetNodeId);
      let newParentId: string | null = null;
      
      if (targetNode) {
        if (targetNode.type === 'location') {
          newParentId = targetNode.id;
        } else if (targetNode.type === 'area') {
          newParentId = targetNode.parent_id || null;
        }
      }
      
      // Call move API
      await api.post(`/api/locations/${draggedNode}/move`, {
        new_parent_id: newParentId,
        new_order_index: 0
      });
      
      // Reload tree
      await loadTreeData();
      
      toast({
        title: "Moved",
        description: "Node moved successfully"
      });
      
    } catch (error: any) {
      console.error('Error moving node:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to move node",
        variant: "destructive"
      });
    } finally {
      setDraggedNode(null);
      setDropTarget(null);
    }
  };

  const handleDeleteNode = async (node: TreeNode) => {
    if (!confirm(`Are you sure you want to delete "${node.name}" and all its children?`)) {
      return;
    }
    
    try {
      await api.delete(`/api/locations/${node.id}`);
      await loadTreeData();
      
      toast({
        title: "Deleted",
        description: `${node.name} has been deleted`
      });
      
    } catch (error: any) {
      console.error('Error deleting node:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete node",
        variant: "destructive"
      });
    }
  };

  const findNodeInTree = (nodes: TreeNode[], nodeId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      const found = findNodeInTree(node.children, nodeId);
      if (found) return found;
    }
    return null;
  };

  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term.trim()) return nodes;
    
    return nodes.reduce<TreeNode[]>((acc, node) => {
      const matchesName = node.name.toLowerCase().includes(term.toLowerCase());
      const filteredChildren = filterTree(node.children, term);
      
      if (matchesName || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren
        });
        
        // Auto-expand nodes that match or have matching children
        if (matchesName || filteredChildren.length > 0) {
          setExpandedNodes(prev => new Set([...prev, node.id]));
        }
      }
      
      return acc;
    }, []);
  };

  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case 'location':
        return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'area':
        return <Building2 className="h-4 w-4 text-green-600" />;
      case 'device':
        return <Cpu className="h-4 w-4 text-purple-600" />;
      case 'data_point':
        return <Database className="h-4 w-4 text-orange-600" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'inactive':
        return <Clock className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  const renderNodeActions = (node: TreeNode) => {
    const canAddChildren = node.type === 'location' || node.type === 'area';
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2">
          <div className="space-y-1">
            {canAddChildren && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setAddDialogConfig({
                    parentId: node.id,
                    nodeType: 'area'
                  });
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-3 w-3 mr-2" />
                Add Area
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onNodeEdit?.(node)}
            >
              <Edit className="h-3 w-3 mr-2" />
              Edit
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-800"
              onClick={() => handleDeleteNode(node)}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const hasChildren = node.children.length > 0;
    const isDragTarget = dropTarget === node.id;
    const canExpand = hasChildren && collapsible;
    
    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center py-1 px-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-100 border-blue-200' : 'hover:bg-gray-50'
          } ${
            isDragTarget ? 'bg-green-100 border-green-200 border-2 border-dashed' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => selectNode(node)}
          draggable={node.type === 'location' || node.type === 'area'}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
        >
          {/* Expand/Collapse Button */}
          <div className="w-5 flex justify-center">
            {canExpand ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            ) : (
              <div className="h-4 w-4" />
            )}
          </div>
          
          {/* Node Icon */}
          <div className="mr-2">
            {getNodeIcon(node)}
          </div>
          
          {/* Node Name and Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm truncate">{node.name}</span>
              
              {showStatus && getStatusIcon(node.status)}
              
              {showCounts && node.device_count !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  🔧 {node.active_device_count || 0}/{node.device_count}
                </Badge>
              )}
              
              {node.alert_count !== undefined && node.alert_count > 0 && (
                <Badge variant="destructive" className="text-xs">
                  🚨 {node.alert_count}
                </Badge>
              )}
              
              {node.type === 'data_point' && node.metadata?.value !== undefined && (
                <Badge variant="outline" className="text-xs font-mono">
                  {node.metadata.value} {node.metadata.unit}
                </Badge>
              )}
            </div>
            
            {node.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {node.description}
              </div>
            )}
          </div>
          
          {/* Actions Menu */}
          {(node.type === 'location' || node.type === 'area') && (
            <div onClick={(e) => e.stopPropagation()}>
              {renderNodeActions(node)}
            </div>
          )}
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = filterTree(treeData, searchTerm);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">System Hierarchy</h3>
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddDialogConfig({ nodeType: 'location' });
                setShowAddDialog(true);
              }}
              className="h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Location
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadTreeData}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {searchable && (
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="Search hierarchy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
        )}
      </div>
      
      {/* Tree Content */}
      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500 text-sm">Loading hierarchy...</div>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'No matching results' : 'No locations configured'}
            </p>
            {!searchTerm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddDialogConfig({ nodeType: 'location' });
                  setShowAddDialog(true);
                }}
                className="mt-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Location
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>
      
      {/* Add Node Dialog */}
      <AddNodeDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        parentId={addDialogConfig.parentId}
        nodeType={addDialogConfig.nodeType}
        onSuccess={loadTreeData}
      />
    </div>
  );
};