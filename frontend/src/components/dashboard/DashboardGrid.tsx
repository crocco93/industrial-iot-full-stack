import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Settings, 
  Trash2, 
  Plus,
  BarChart3,
  Activity,
  Gauge,
  List,
  TrendingUp
} from 'lucide-react';

interface DashboardWidget {
  id: string;
  type: 'gauge' | 'line_chart' | 'bar_chart' | 'kpi' | 'status' | 'table';
  title: string;
  data_point_ids: string[];
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: {
    thresholds?: { warning: number; critical: number };
    colors?: string[];
    show_legend?: boolean;
    time_range?: string;
    aggregation?: 'raw' | 'hourly' | 'daily';
    [key: string]: any;
  };
}

interface DashboardGridProps {
  widgets: DashboardWidget[];
  onWidgetUpdate: (widgets: DashboardWidget[]) => void;
  onWidgetAdd: (type: DashboardWidget['type']) => void;
  onWidgetEdit: (widget: DashboardWidget) => void;
  onWidgetDelete: (widgetId: string) => void;
  editable?: boolean;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  widgets,
  onWidgetUpdate,
  onWidgetAdd,
  onWidgetEdit,
  onWidgetDelete,
  editable = true
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    setDraggedWidget(widgetId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, widgetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOver(widgetId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDraggedOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    
    if (!draggedWidget || draggedWidget === targetWidgetId) {
      setDraggedWidget(null);
      setDraggedOver(null);
      setIsDragging(false);
      return;
    }

    const sourceWidget = widgets.find(w => w.id === draggedWidget);
    const targetWidget = widgets.find(w => w.id === targetWidgetId);
    
    if (sourceWidget && targetWidget) {
      // Swap positions
      const updatedWidgets = widgets.map(widget => {
        if (widget.id === draggedWidget) {
          return { ...widget, position: targetWidget.position };
        }
        if (widget.id === targetWidgetId) {
          return { ...widget, position: sourceWidget.position };
        }
        return widget;
      });
      
      onWidgetUpdate(updatedWidgets);
    }
    
    setDraggedWidget(null);
    setDraggedOver(null);
    setIsDragging(false);
  }, [draggedWidget, widgets, onWidgetUpdate]);

  const getWidgetIcon = (type: DashboardWidget['type']) => {
    switch (type) {
      case 'gauge': return <Gauge className="h-4 w-4" />;
      case 'line_chart': return <TrendingUp className="h-4 w-4" />;
      case 'bar_chart': return <BarChart3 className="h-4 w-4" />;
      case 'kpi': return <Activity className="h-4 w-4" />;
      case 'status': return <Activity className="h-4 w-4" />;
      case 'table': return <List className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getWidgetTypeColor = (type: DashboardWidget['type']) => {
    switch (type) {
      case 'gauge': return 'bg-blue-100 text-blue-800';
      case 'line_chart': return 'bg-green-100 text-green-800';
      case 'bar_chart': return 'bg-purple-100 text-purple-800';
      case 'kpi': return 'bg-orange-100 text-orange-800';
      case 'status': return 'bg-gray-100 text-gray-800';
      case 'table': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate grid layout (responsive grid)
  const getGridClass = (position: DashboardWidget['position']) => {
    return `relative ${
      position.width === 1 ? 'col-span-1' : 
      position.width === 2 ? 'col-span-2' : 
      position.width === 3 ? 'col-span-3' : 
      'col-span-4'
    } ${
      position.height === 1 ? 'row-span-1' : 
      position.height === 2 ? 'row-span-2' : 
      'row-span-3'
    }`;
  };

  const widgetTypes: { type: DashboardWidget['type']; label: string; description: string }[] = [
    { type: 'gauge', label: 'Gauge', description: 'Circular gauge for single values' },
    { type: 'line_chart', label: 'Line Chart', description: 'Time series line chart' },
    { type: 'bar_chart', label: 'Bar Chart', description: 'Bar chart for comparisons' },
    { type: 'kpi', label: 'KPI Card', description: 'Key performance indicator' },
    { type: 'status', label: 'Status', description: 'Status indicator widget' },
    { type: 'table', label: 'Table', description: 'Data table widget' }
  ];

  return (
    <div className="space-y-4">
      {/* Add Widget Toolbar */}
      {editable && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Widgets</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {widgetTypes.map(({ type, label, description }) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  onClick={() => onWidgetAdd(type)}
                  className="flex items-center space-x-1"
                  title={description}
                >
                  {getWidgetIcon(type)}
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Widgets Grid */}
      <div 
        className={`grid grid-cols-4 gap-4 auto-rows-min transition-opacity ${
          isDragging ? 'opacity-50' : 'opacity-100'
        }`}
      >
        {widgets.map(widget => (
          <div
            key={widget.id}
            className={getGridClass(widget.position)}
            draggable={editable}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, widget.id)}
          >
            <Card 
              className={`h-full transition-all duration-200 ${
                draggedOver === widget.id ? 'ring-2 ring-blue-500' : ''
              } ${
                draggedWidget === widget.id ? 'scale-105 shadow-lg' : ''
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {editable && (
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                    )}
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Badge 
                      className={`text-xs ${getWidgetTypeColor(widget.type)}`}
                    >
                      {getWidgetIcon(widget.type)}
                    </Badge>
                    
                    {editable && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onWidgetEdit(widget)}
                          className="h-6 w-6 p-0"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onWidgetDelete(widget.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Widget Content Placeholder */}
                <div className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded p-4 min-h-[100px]">
                  <div className="text-center">
                    {getWidgetIcon(widget.type)}
                    <div className="text-xs mt-2 capitalize">
                      {widget.type.replace('_', ' ')} Widget
                    </div>
                    <div className="text-xs text-gray-500">
                      {widget.data_point_ids.length} data point{widget.data_point_ids.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
        
        {/* Add Widget Card */}
        {editable && widgets.length < 12 && (
          <div className="col-span-1 row-span-1">
            <Card className="h-full border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
              <CardContent className="flex items-center justify-center h-full">
                <Button
                  variant="ghost"
                  onClick={() => onWidgetAdd('gauge')}
                  className="h-full w-full flex flex-col items-center justify-center space-y-2 text-gray-500 hover:text-gray-700"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-xs">Add Widget</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Grid Legend */}
      {editable && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-600">
              <p><strong>Grid Layout:</strong> Drag widgets to rearrange. Each widget can be resized and repositioned.</p>
              <p><strong>Sizes:</strong> 1x1 (small), 2x1 (medium), 2x2 (large), 4x1 (wide)</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};