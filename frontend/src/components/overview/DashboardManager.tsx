import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Edit, 
  Trash2, 
  BarChart3, 
  Gauge, 
  Activity, 
  TrendingUp,
  Grid3X3,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface DataPoint {
  id: string;
  name: string;
  device_id: string;
  device_name: string;
  address: string;
  data_type: string;
  unit: string;
  current_value: any;
  min_value?: number;
  max_value?: number;
}

interface Widget {
  id: string;
  type: 'gauge' | 'line_chart' | 'bar_chart' | 'kpi' | 'status' | 'table';
  title: string;
  data_point_ids: string[];
  position: { x: number; y: number; w: number; h: number };
  configuration: Record<string, any>;
  visible: boolean;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  layout: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface DashboardManagerProps {
  currentDashboard?: Dashboard;
  onDashboardChange?: (dashboard: Dashboard) => void;
}

const WIDGET_TYPES = [
  { value: 'gauge', label: 'Gauge', icon: Gauge, description: 'Circular gauge for single values' },
  { value: 'line_chart', label: 'Line Chart', icon: TrendingUp, description: 'Time series line chart' },
  { value: 'bar_chart', label: 'Bar Chart', icon: BarChart3, description: 'Bar chart comparison' },
  { value: 'kpi', label: 'KPI Card', icon: Activity, description: 'Key Performance Indicator card' },
  { value: 'status', label: 'Status Badge', icon: Badge, description: 'Device status indicator' },
  { value: 'table', label: 'Data Table', icon: Grid3X3, description: 'Tabular data display' }
];

export function DashboardManager({ currentDashboard, onDashboardChange }: DashboardManagerProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [showWidgetDialog, setShowWidgetDialog] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [newDashboard, setNewDashboard] = useState({ name: '', description: '' });
  const [newWidget, setNewWidget] = useState({
    type: 'gauge',
    title: '',
    data_point_ids: [] as string[],
    configuration: {}
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboards();
    loadDataPoints();
  }, []);

  const loadDashboards = async () => {
    try {
      const response = await api.get('/api/dashboards');
      setDashboards(response.data || []);
    } catch (error) {
      console.error('Error loading dashboards:', error);
      // Create default dashboard if none exist
      const defaultDashboard: Dashboard = {
        id: 'default',
        name: 'Default Dashboard',
        description: 'System overview dashboard',
        widgets: [],
        layout: 'grid',
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setDashboards([defaultDashboard]);
    }
  };

  const loadDataPoints = async () => {
    try {
      const [dataPointsResponse, devicesResponse] = await Promise.all([
        api.get('/api/data-points'),
        api.get('/api/devices')
      ]);
      
      const dataPointsData = dataPointsResponse.data || [];
      const devicesData = devicesResponse.data || [];
      
      // Enrich data points with device names
      const enrichedDataPoints = dataPointsData.map((dp: any) => {
        const device = devicesData.find((d: any) => d.id === dp.device_id);
        return {
          ...dp,
          device_name: device?.name || 'Unknown Device'
        };
      });
      
      setDataPoints(enrichedDataPoints);
    } catch (error) {
      console.error('Error loading data points:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboard.name) {
      toast({
        title: "Validation Error",
        description: "Dashboard name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const dashboardData = {
        ...newDashboard,
        widgets: [],
        layout: 'grid',
        is_default: dashboards.length === 0
      };

      await api.post('/api/dashboards', dashboardData);
      
      toast({
        title: "Dashboard Created",
        description: `${newDashboard.name} has been created`
      });
      
      await loadDashboards();
      setShowDashboardDialog(false);
      setNewDashboard({ name: '', description: '' });
      
    } catch (error: any) {
      console.error('Error creating dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to create dashboard",
        variant: "destructive"
      });
    }
  };

  const handleCreateWidget = async () => {
    if (!newWidget.title || newWidget.data_point_ids.length === 0) {
      toast({
        title: "Validation Error",
        description: "Widget title and at least one data point are required",
        variant: "destructive"
      });
      return;
    }

    try {
      const widget: Widget = {
        id: `widget_${Date.now()}`,
        type: newWidget.type as Widget['type'],
        title: newWidget.title,
        data_point_ids: newWidget.data_point_ids,
        position: { x: 0, y: 0, w: 2, h: 2 },
        configuration: newWidget.configuration,
        visible: true
      };

      if (editingDashboard) {
        const updatedDashboard = {
          ...editingDashboard,
          widgets: [...editingDashboard.widgets, widget],
          updated_at: new Date().toISOString()
        };

        await api.put(`/api/dashboards/${editingDashboard.id}`, updatedDashboard);
        
        toast({
          title: "Widget Added",
          description: `${newWidget.title} widget has been added`
        });
        
        await loadDashboards();
        setShowWidgetDialog(false);
        setNewWidget({
          type: 'gauge',
          title: '',
          data_point_ids: [],
          configuration: {}
        });
      }
    } catch (error: any) {
      console.error('Error creating widget:', error);
      toast({
        title: "Error",
        description: "Failed to create widget",
        variant: "destructive"
      });
    }
  };

  const toggleWidgetVisibility = async (dashboardId: string, widgetId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId);
      if (!dashboard) return;
      
      const updatedWidgets = dashboard.widgets.map(w => 
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      );
      
      const updatedDashboard = {
        ...dashboard,
        widgets: updatedWidgets,
        updated_at: new Date().toISOString()
      };

      await api.put(`/api/dashboards/${dashboardId}`, updatedDashboard);
      await loadDashboards();
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update widget visibility",
        variant: "destructive"
      });
    }
  };

  const deleteWidget = async (dashboardId: string, widgetId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId);
      if (!dashboard) return;
      
      const updatedWidgets = dashboard.widgets.filter(w => w.id !== widgetId);
      
      const updatedDashboard = {
        ...dashboard,
        widgets: updatedWidgets,
        updated_at: new Date().toISOString()
      };

      await api.put(`/api/dashboards/${dashboardId}`, updatedDashboard);
      await loadDashboards();
      
      toast({
        title: "Widget Deleted",
        description: "Widget has been removed from dashboard"
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete widget",
        variant: "destructive"
      });
    }
  };

  const getWidgetIcon = (type: string) => {
    const widgetType = WIDGET_TYPES.find(wt => wt.value === type);
    return widgetType ? <widgetType.icon className="h-4 w-4" /> : <Activity className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Management</h2>
          <p className="text-gray-600">Create and customize your industrial monitoring dashboards</p>
        </div>
        <Button onClick={() => setShowDashboardDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Dashboard
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading dashboards...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>{dashboard.name}</span>
                    {dashboard.is_default && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingDashboard(dashboard);
                        setShowWidgetDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Widget
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDashboardChange?.(dashboard)}
                    >
                      View
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {dashboard.description} • {dashboard.widgets.length} widgets 
                  • Updated {new Date(dashboard.updated_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.widgets.length === 0 ? (
                  <div className="text-center py-8">
                    <Grid3X3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No widgets configured</p>
                    <Button 
                      className="mt-2" 
                      size="sm" 
                      onClick={() => {
                        setEditingDashboard(dashboard);
                        setShowWidgetDialog(true);
                      }}
                    >
                      Add First Widget
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboard.widgets.map((widget) => {
                      const selectedDataPoints = dataPoints.filter(dp => 
                        widget.data_point_ids.includes(dp.id)
                      );
                      
                      return (
                        <div key={widget.id} className={`p-3 border rounded-lg ${
                          widget.visible ? 'bg-white' : 'bg-gray-50 opacity-60'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {getWidgetIcon(widget.type)}
                              <span className="font-medium text-sm">{widget.title}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleWidgetVisibility(dashboard.id, widget.id)}
                              >
                                {widget.visible ? 
                                  <Eye className="h-3 w-3" /> : 
                                  <EyeOff className="h-3 w-3" />
                                }
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingWidget(widget);
                                  setEditingDashboard(dashboard);
                                  setNewWidget({
                                    type: widget.type,
                                    title: widget.title,
                                    data_point_ids: widget.data_point_ids,
                                    configuration: widget.configuration
                                  });
                                  setShowWidgetDialog(true);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                                onClick={() => deleteWidget(dashboard.id, widget.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              Type: {WIDGET_TYPES.find(wt => wt.value === widget.type)?.label}
                            </div>
                            
                            {selectedDataPoints.length > 0 && (
                              <div className="text-xs text-gray-600">
                                <strong>Data Points:</strong>
                                <div className="mt-1 space-y-0.5">
                                  {selectedDataPoints.slice(0, 3).map(dp => (
                                    <div key={dp.id} className="flex items-center justify-between">
                                      <span className="truncate">{dp.name}</span>
                                      <Badge variant="outline" className="text-xs ml-2">
                                        {dp.current_value} {dp.unit}
                                      </Badge>
                                    </div>
                                  ))}
                                  {selectedDataPoints.length > 3 && (
                                    <div className="text-gray-500">... and {selectedDataPoints.length - 3} more</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dashboard Dialog */}
      <Dialog open={showDashboardDialog} onOpenChange={setShowDashboardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Create a custom dashboard for monitoring your industrial systems
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="dashboard-name">Dashboard Name</Label>
              <Input
                id="dashboard-name"
                value={newDashboard.name}
                onChange={(e) => setNewDashboard(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Production Overview, HVAC Monitoring..."
              />
            </div>
            
            <div>
              <Label htmlFor="dashboard-description">Description</Label>
              <Textarea
                id="dashboard-description"
                value={newDashboard.description}
                onChange={(e) => setNewDashboard(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description of what this dashboard monitors..."
                rows={2}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDashboardDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDashboard}>
              Create Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Widget Dialog */}
      <Dialog open={showWidgetDialog} onOpenChange={setShowWidgetDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWidget ? 'Edit Widget' : 'Add New Widget'}
            </DialogTitle>
            <DialogDescription>
              Configure a widget to display data from your industrial devices
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Widget Configuration */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="widget-title">Widget Title</Label>
                  <Input
                    id="widget-title"
                    value={newWidget.title}
                    onChange={(e) => setNewWidget(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Temperature Trend, Power Consumption..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="widget-type">Widget Type</Label>
                  <Select value={newWidget.type} onValueChange={(value) => setNewWidget(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center space-x-2">
                            <type.icon className="h-4 w-4" />
                            <div>
                              <div>{type.label}</div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Data Points Selection */}
            <div>
              <Label>Select Data Points</Label>
              <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                {dataPoints.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No data points available</p>
                ) : (
                  dataPoints.map(dp => (
                    <div key={dp.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`dp-${dp.id}`}
                        checked={newWidget.data_point_ids.includes(dp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWidget(prev => ({
                              ...prev,
                              data_point_ids: [...prev.data_point_ids, dp.id]
                            }));
                          } else {
                            setNewWidget(prev => ({
                              ...prev,
                              data_point_ids: prev.data_point_ids.filter(id => id !== dp.id)
                            }));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`dp-${dp.id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium text-sm">{dp.name}</div>
                        <div className="text-xs text-gray-500">
                          {dp.device_name} • {dp.current_value} {dp.unit} • {dp.data_type}
                        </div>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {newWidget.data_point_ids.length > 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  {newWidget.data_point_ids.length} data point{newWidget.data_point_ids.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowWidgetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWidget}>
              {editingWidget ? 'Update Widget' : 'Create Widget'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}