import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Building2,
  Factory,
  Plus,
  Edit,
  Trash2,
  Move,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Location {
  id: string;
  name: string;
  description?: string;
  type: 'factory' | 'area' | 'zone' | 'line';
  parent_id?: string;
  path: string;
  order_index: number;
  status: 'active' | 'inactive' | 'maintenance';
  metadata: Record<string, any>;
  device_count?: number;
  alert_count?: number;
  children?: Location[];
  created_at: string;
  updated_at: string;
}

interface LocationFormData {
  name: string;
  description: string;
  type: 'factory' | 'area' | 'zone' | 'line';
  parent_id: string;
  metadata: Record<string, any>;
}

const LOCATION_TYPES = [
  { value: 'factory', label: 'Factory', icon: Factory, description: 'Manufacturing facility or plant' },
  { value: 'area', label: 'Production Area', icon: Building2, description: 'Major production area within factory' },
  { value: 'zone', label: 'Work Zone', icon: MapPin, description: 'Specific work zone or cell' },
  { value: 'line', label: 'Production Line', icon: MapPin, description: 'Individual production line' }
] as const;

interface LocationManagerProps {
  onLocationSelect?: (location: Location) => void;
  selectedLocationId?: string;
  allowEdit?: boolean;
}

export const LocationManager: React.FC<LocationManagerProps> = ({
  onLocationSelect,
  selectedLocationId,
  allowEdit = true
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    description: '',
    type: 'area',
    parent_id: '',
    metadata: {}
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/locations/tree');
      setLocations(response.data || []);
      
      // Auto-expand top level items
      const topLevelIds = new Set((response.data || []).map((loc: Location) => loc.id));
      setExpandedIds(topLevelIds);
      
    } catch (error) {
      console.error('Error loading locations:', error);
      toast({
        title: "Load Error",
        description: "Failed to load location hierarchy",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async () => {
    try {
      const response = await api.post('/api/locations', formData);
      await loadLocations();
      
      toast({
        title: "Location Created",
        description: `${formData.name} has been created successfully`
      });
      
      setShowAddDialog(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Create Failed",
        description: error.response?.data?.detail || "Failed to create location",
        variant: "destructive"
      });
    }
  };

  const updateLocation = async () => {
    if (!editingLocation) return;
    
    try {
      const response = await api.put(`/api/locations/${editingLocation.id}`, formData);
      await loadLocations();
      
      toast({
        title: "Location Updated",
        description: `${formData.name} has been updated successfully`
      });
      
      setEditingLocation(null);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.response?.data?.detail || "Failed to update location",
        variant: "destructive"
      });
    }
  };

  const deleteLocation = async (location: Location) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"? This will also remove all child locations and devices.`)) {
      return;
    }
    
    try {
      await api.delete(`/api/locations/${location.id}`);
      await loadLocations();
      
      toast({
        title: "Location Deleted",
        description: `${location.name} has been deleted`
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.response?.data?.detail || "Failed to delete location",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'area',
      parent_id: '',
      metadata: {}
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getLocationIcon = (type: string) => {
    const locationTypeConfig = LOCATION_TYPES.find(t => t.value === type);
    const IconComponent = locationTypeConfig?.icon || MapPin;
    return <IconComponent className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>;
      case 'maintenance':
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Maintenance</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800 text-xs">Inactive</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };

  const filterLocations = (locations: Location[], searchTerm: string): Location[] => {
    if (!searchTerm) return locations;
    
    return locations.filter(location => {
      const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (location.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Also check children
      const hasMatchingChildren = location.children ? 
        filterLocations(location.children, searchTerm).length > 0 : false;
      
      return matchesSearch || hasMatchingChildren;
    }).map(location => ({
      ...location,
      children: location.children ? filterLocations(location.children, searchTerm) : []
    }));
  };

  const renderLocationTree = (locations: Location[], level = 0) => {
    const filteredLocations = filterLocations(locations, searchTerm);
    
    return filteredLocations.map((location) => (
      <div key={location.id} className="select-none">
        <div 
          className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
            selectedLocationId === location.id ? 'bg-blue-50 border-blue-200 border' : ''
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => onLocationSelect?.(location)}
        >
          {/* Expand/Collapse Button */}
          {location.children && location.children.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="p-0 h-4 w-4"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(location.id);
              }}
            >
              {expandedIds.has(location.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-4" /> // Spacer
          )}
          
          {/* Location Icon */}
          <div className="text-gray-600">
            {getLocationIcon(location.type)}
          </div>
          
          {/* Location Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm truncate">{location.name}</span>
              {getStatusBadge(location.status)}
            </div>
            
            {/* Location Stats */}
            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
              {location.device_count !== undefined && (
                <span>{location.device_count} devices</span>
              )}
              {location.alert_count !== undefined && location.alert_count > 0 && (
                <span className="text-red-600">{location.alert_count} alerts</span>
              )}
              <span className="capitalize">{location.type}</span>
            </div>
          </div>
          
          {/* Action Buttons */}
          {allowEdit && (
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="ghost"
                className="p-1 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingLocation(location);
                  setFormData({
                    name: location.name,
                    description: location.description || '',
                    type: location.type,
                    parent_id: location.parent_id || '',
                    metadata: location.metadata || {}
                  });
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                className="p-1 h-6 w-6 text-red-600 hover:text-red-800"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLocation(location);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Render Children */}
        {expandedIds.has(location.id) && location.children && (
          <div>
            {renderLocationTree(location.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const flattenLocations = (locations: Location[]): Location[] => {
    const flat: Location[] = [];
    
    const traverse = (locs: Location[]) => {
      for (const loc of locs) {
        flat.push(loc);
        if (loc.children) {
          traverse(loc.children);
        }
      }
    };
    
    traverse(locations);
    return flat;
  };

  const availableParents = flattenLocations(locations).filter(
    loc => !editingLocation || loc.id !== editingLocation.id
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Locations & Areas</h3>
        {allowEdit && (
          <Button
            size="sm"
            onClick={() => {
              setShowAddDialog(true);
              resetForm();
            }}
            className="h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      
      {/* Location Tree */}
      <div className="max-h-96 overflow-auto border rounded-lg bg-white">
        {loading ? (
          <div className="p-4 text-center text-gray-600">Loading locations...</div>
        ) : locations.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No locations configured</p>
            <p className="text-sm text-gray-500">Add your first factory or production area to get started</p>
            {allowEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setShowAddDialog(true);
                  resetForm();
                }}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Location
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {renderLocationTree(locations)}
          </div>
        )}
      </div>
      
      {/* Location Statistics */}
      {locations.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-semibold text-blue-800">{flattenLocations(locations).length}</div>
            <div className="text-blue-600">Total Locations</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-semibold text-green-800">
              {flattenLocations(locations).filter(l => l.status === 'active').length}
            </div>
            <div className="text-green-600">Active</div>
          </div>
        </div>
      )}

      {/* Add/Edit Location Dialog */}
      <Dialog open={showAddDialog || editingLocation !== null} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingLocation(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription>
              {editingLocation 
                ? `Update the details for ${editingLocation.name}`
                : 'Create a new location in your facility hierarchy'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Main Production Hall"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this location..."
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="type">Location Type *</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(type => {
                    const IconComponent = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center space-x-2">
                          <IconComponent className="h-4 w-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {LOCATION_TYPES.find(t => t.value === formData.type) && (
                <p className="text-xs text-gray-500 mt-1">
                  {LOCATION_TYPES.find(t => t.value === formData.type)?.description}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="parent">Parent Location</Label>
              <Select 
                value={formData.parent_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, parent_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Parent (Top Level)</SelectItem>
                  {availableParents.map(parent => (
                    <SelectItem key={parent.id} value={parent.id}>
                      <div className="flex items-center space-x-2">
                        {getLocationIcon(parent.type)}
                        <span>{parent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {parent.type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingLocation(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingLocation ? updateLocation : createLocation}
              disabled={!formData.name || !formData.type}
            >
              {editingLocation ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};