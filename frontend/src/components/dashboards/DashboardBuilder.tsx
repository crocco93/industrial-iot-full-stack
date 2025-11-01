import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  Move,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Gauge,
  TrendingUp,
  Clock,
  MapPin,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Download,
  Settings,
  Grid3X3,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'status' | 'list' | 'gauge' | 'map';
  title: string;
  description?: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    data_source: string;  // API endpoint or data source
    refresh_interval: number;  // seconds
    chart_type?: 'line' | 'bar' | 'pie' | 'area' | 'gauge';
    filters?: Record<string, any>;
    display_options?: Record<string, any>;
  };
  visible: boolean;
  created_at: string;
  updated_at: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'flexible';
  theme: 'light' | 'dark';
  auto_refresh: boolean;
  refresh_interval: number;
  public: boolean;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

const WIDGET_TYPES = [
  {
    type: 'metric',
    label: 'Metric Card',
    icon: TrendingUp,
    description: 'Display single KPI or metric value',
    defaultSize: { width: 1, height: 1 }
  },
  {
    type: 'chart',
    label: 'Data Chart', 
    icon: LineChart,
    description: 'Line, bar, or pie charts',
    defaultSize: { width: 2, height: 2 }
  },
  {
    type: 'gauge',
    label: 'Gauge/Dial',
    icon: Gauge,
    description: 'Circular gauge for single values',
    defaultSize: { width: 1, height: 1 }
  },
  {
    type: 'status',
    label: 'Status Grid',
    icon: Activity,
    description: 'Device or connection status grid',
    defaultSize: { width: 2, height: 1 }
  },
  {
    type: 'list',
    label: 'Data List',
    icon: BarChart3,
    description: 'Tabular data or recent events',
    defaultSize: { width: 2, height: 2 }
  },
  {
    type: 'map',
    label: 'Location Map',
    icon: MapPin,
    description: 'Facility layout or device locations',
    defaultSize: { width: 3, height: 2 }
  }
];

const DATA_SOURCES = [
  { value: '/api/protocols', label: 'Protocols Status', description: 'Current protocol connection status' },
  { value: '/api/devices', label: 'Device List', description: 'All configured devices' },
  { value: '/api/connections', label: 'Connections', description: 'Active device connections' },
  { value: '/api/alerts', label: 'System Alerts', description: 'Recent alerts and warnings' },
  { value: '/api/monitoring/data-points', label: 'Data Points', description: 'Real-time sensor data' },
  { value: '/api/historical/trends', label: 'Historical Trends', description: 'Historical data analysis' },
  { value: '/api/locations/tree', label: 'Location Hierarchy', description: 'Factory locations and areas' },
  { value: '/api/integrations/n8n/workflows', label: 'N8N Workflows', description: 'Automation workflows' }
];

interface DashboardBuilderProps {
  dashboardId?: string;
  onSave?: (dashboard: Dashboard) => void;
  onCancel?: () => void;
}

export function DashboardBuilder({ dashboardId, onSave, onCancel }: DashboardBuilderProps) {
  const [dashboard, setDashboard] = useState<Dashboard>({
    id: dashboardId || '',
    name: 'New Dashboard',
    description: '',
    widgets: [],
    layout: 'grid',
    theme: 'light',
    auto_refresh: true,
    refresh_interval: 30,
    public: false,
    tags: [],
    created_by: 'current_user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);
  const [showWidgetDialog, setShowWidgetDialog] = useState(false);
  const [widgetForm, setWidgetForm] = useState<Partial<DashboardWidget>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { toast } = useToast();
  
  useEffect(() => {
    if (dashboardId) {
      loadDashboard();
    }
  }, [dashboardId]);
  
  const loadDashboard = async () => {
    if (!dashboardId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/api/dashboards/${dashboardId}`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load dashboard configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const saveDashboard = async () => {
    try {
      setSaving(true);
      
      const dashboardData = {
        ...dashboard,
        updated_at: new Date().toISOString()
      };
      
      let response;
      if (dashboardId) {
        response = await api.put(`/api/dashboards/${dashboardId}`, dashboardData);
      } else {
        response = await api.post('/api/dashboards', dashboardData);
      }
      
      setDashboard(response.data);
      
      toast({
        title: "Dashboard Saved",
        description: `${dashboard.name} has been saved successfully`
      });
      
      onSave?.(response.data);
      
    } catch (error: any) {
      console.error('Failed to save dashboard:', error);
      toast({
        title: "Save Failed",
        description: error.response?.data?.detail || "Failed to save dashboard",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  
  const addWidget = () => {
    setWidgetForm({
      type: 'metric',
      title: 'New Widget',
      position: { x: 0, y: 0, width: 1, height: 1 },
      config: {
        data_source: '/api/protocols',
        refresh_interval: 30
      },
      visible: true
    });
    setSelectedWidget(null);
    setShowWidgetDialog(true);
  };
  
  const editWidget = (widget: DashboardWidget) => {
    setWidgetForm(widget);
    setSelectedWidget(widget);
    setShowWidgetDialog(true);
  };
  
  const saveWidget = () => {
    if (!widgetForm.title || !widgetForm.type) {
      toast({
        title: "Validation Error",
        description: "Widget title and type are required",
        variant: "destructive"
      });
      return;
    }
    
    const widget: DashboardWidget = {
      id: selectedWidget?.id || `widget_${Date.now()}`,
      type: widgetForm.type as any,
      title: widgetForm.title || 'Untitled Widget',
      description: widgetForm.description,
      position: widgetForm.position || { x: 0, y: 0, width: 1, height: 1 },
      config: widgetForm.config || { data_source: '/api/protocols', refresh_interval: 30 },
      visible: widgetForm.visible !== false,
      created_at: selectedWidget?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (selectedWidget) {
      // Update existing widget
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.map(w => w.id === selectedWidget.id ? widget : w)
      }));
    } else {
      // Add new widget
      setDashboard(prev => ({
        ...prev,
        widgets: [...prev.widgets, widget]
      }));
    }
    
    setShowWidgetDialog(false);
    setWidgetForm({});
    setSelectedWidget(null);
  };
  
  const deleteWidget = (widgetId: string) => {
    if (confirm('Are you sure you want to delete this widget?')) {
      setDashboard(prev => ({
        ...prev,
        widgets: prev.widgets.filter(w => w.id !== widgetId)
      }));
    }
  };
  
  const getWidgetTypeIcon = (type: string) => {
    const widgetType = WIDGET_TYPES.find(wt => wt.type === type);
    const IconComponent = widgetType?.icon || BarChart3;
    return <IconComponent className="h-4 w-4" />;
  };
  
  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div>
            <Input
              value={dashboard.name}
              onChange={(e) => setDashboard(prev => ({ ...prev, name: e.target.value }))}
              className="text-xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
              placeholder="Dashboard Name"
            />
          </div>
          <Textarea
            value={dashboard.description}
            onChange={(e) => setDashboard(prev => ({ ...prev, description: e.target.value }))}
            className="resize-none bg-transparent border-none p-0 text-gray-600 focus-visible:ring-0"
            placeholder="Dashboard description..."
            rows={2}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={saveDashboard} disabled={saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Save Dashboard
          </Button>
        </div>
      </div>
      
      {/* Dashboard Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dashboard Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Layout Style</Label>
              <Select 
                value={dashboard.layout} 
                onValueChange={(value: any) => setDashboard(prev => ({ ...prev, layout: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">
                    <div className="flex items-center space-x-2">
                      <Grid3X3 className="h-4 w-4" />
                      <span>Grid Layout</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="flexible">
                    <div className="flex items-center space-x-2">
                      <Maximize2 className="h-4 w-4" />
                      <span>Flexible Layout</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Theme</Label>
              <Select 
                value={dashboard.theme} 
                onValueChange={(value: any) => setDashboard(prev => ({ ...prev, theme: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Theme</SelectItem>
                  <SelectItem value="dark">Dark Theme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Refresh Interval</Label>
              <Select 
                value={dashboard.refresh_interval.toString()} 
                onValueChange={(value) => setDashboard(prev => ({ ...prev, refresh_interval: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={dashboard.auto_refresh}
                onCheckedChange={(checked) => setDashboard(prev => ({ ...prev, auto_refresh: checked }))}
              />
              <Label>Auto-refresh enabled</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={dashboard.public}
                onCheckedChange={(checked) => setDashboard(prev => ({ ...prev, public: checked }))}
              />
              <Label>Public dashboard</Label>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Widgets Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <LayoutDashboard className="h-5 w-5 mr-2" />
              Dashboard Widgets ({dashboard.widgets.length})
            </div>
            <Button onClick={addWidget}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.widgets.length === 0 ? (
            <div className="text-center py-12">
              <LayoutDashboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Widgets</h3>
              <p className="text-gray-600 mb-4">Start building your dashboard by adding widgets</p>
              <Button onClick={addWidget}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Widget
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.widgets.map((widget, index) => (
                <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {widget.visible ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                      {getWidgetTypeIcon(widget.type)}
                    </div>
                    
                    <div>
                      <div className="font-medium">{widget.title}</div>
                      <div className="text-sm text-gray-600 flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {widget.type}
                        </Badge>
                        <span>•</span>
                        <span>{widget.config.data_source}</span>
                        <span>•</span>
                        <span>Refresh: {widget.config.refresh_interval}s</span>
                      </div>
                      {widget.description && (
                        <p className="text-xs text-gray-500 mt-1">{widget.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => editWidget(widget)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDashboard(prev => ({
                          ...prev,
                          widgets: prev.widgets.map(w => 
                            w.id === widget.id ? { ...w, visible: !w.visible } : w
                          )
                        }));
                      }}
                    >
                      {widget.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteWidget(widget.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Dashboard Preview */}
      {dashboard.widgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Preview</CardTitle>
            <CardDescription>Preview of how your dashboard will look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${
              dashboard.layout === 'grid' 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                : 'grid-cols-1'
            }`}>
              {dashboard.widgets.filter(w => w.visible).map((widget) => (
                <Card key={widget.id} className="border-2 border-dashed border-gray-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center space-x-2">
                      {getWidgetTypeIcon(widget.type)}
                      <span>{widget.title}</span>
                      <Badge variant="outline" className="text-xs">{widget.type}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-sm mb-2">Widget Preview</div>
                      <div className="text-xs">{widget.config.data_source}</div>
                      {widget.description && (
                        <div className="text-xs mt-2">{widget.description}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Widget Configuration Dialog */}
      <Dialog open={showWidgetDialog} onOpenChange={setShowWidgetDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedWidget ? 'Edit Widget' : 'Add New Widget'}
            </DialogTitle>
            <DialogDescription>
              Configure the widget properties and data source
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="widget-title">Widget Title *</Label>
                <Input
                  id="widget-title"
                  value={widgetForm.title || ''}
                  onChange={(e) => setWidgetForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Protocol Status"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="widget-type">Widget Type *</Label>
                <Select 
                  value={widgetForm.type} 
                  onValueChange={(value: any) => setWidgetForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select widget type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_TYPES.map(type => {
                      const IconComponent = type.icon;
                      return (
                        <SelectItem key={type.type} value={type.type}>
                          <div className="flex items-center space-x-2">
                            <IconComponent className="h-4 w-4" />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="widget-description">Description (optional)</Label>
              <Textarea
                id="widget-description"
                value={widgetForm.description || ''}
                onChange={(e) => setWidgetForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this widget..."
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="data-source">Data Source *</Label>
              <Select 
                value={widgetForm.config?.data_source} 
                onValueChange={(value) => setWidgetForm(prev => ({ 
                  ...prev, 
                  config: { ...prev.config, data_source: value } 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select data source" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      <div>
                        <div className="font-medium text-sm">{source.label}</div>
                        <div className="text-xs text-gray-500">{source.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
                <Select 
                  value={widgetForm.config?.refresh_interval?.toString() || '30'} 
                  onValueChange={(value) => setWidgetForm(prev => ({ 
                    ...prev, 
                    config: { ...prev.config, refresh_interval: parseInt(value) } 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {widgetForm.type === 'chart' && (
                <div>
                  <Label htmlFor="chart-type">Chart Type</Label>
                  <Select 
                    value={widgetForm.config?.chart_type || 'line'} 
                    onValueChange={(value) => setWidgetForm(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, chart_type: value } 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">
                        <div className="flex items-center space-x-2">
                          <LineChart className="h-4 w-4" />
                          <span>Line Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bar">
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>Bar Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pie">
                        <div className="flex items-center space-x-2">
                          <PieChart className="h-4 w-4" />
                          <span>Pie Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="area">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4" />
                          <span>Area Chart</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={widgetForm.visible !== false}
                onCheckedChange={(checked) => setWidgetForm(prev => ({ ...prev, visible: checked }))}
              />
              <Label>Widget visible on dashboard</Label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowWidgetDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveWidget}
              disabled={!widgetForm.title || !widgetForm.type}
            >
              {selectedWidget ? 'Update Widget' : 'Add Widget'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}