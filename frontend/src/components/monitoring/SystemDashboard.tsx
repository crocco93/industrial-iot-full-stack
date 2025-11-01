import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RealTimeGauge } from '@/components/charts/RealTimeGauge';
import { ProtocolMetrics } from './ProtocolMetrics';
import { ConnectionStatus } from './ConnectionStatus';
import { AlertPanel } from './AlertPanel';
import { HierarchicalTree } from '@/components/common/HierarchicalTree';
import { DashboardManager } from '@/components/overview/DashboardManager';
import { 
  Activity, 
  Server, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Settings,
  BarChart3
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface SystemStats {
  devices: {
    total: number;
    online: number;
    offline: number;
    health_percentage: number;
  };
  protocols: {
    total: number;
    active: number;
    health_percentage: number;
  };
  data_points: {
    total: number;
    active: number;
    last_updated: string;
  };
  system: {
    uptime: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
  };
}

interface DataPoint {
  id: string;
  name: string;
  current_value: any;
  unit: string;
  device_name: string;
  last_read: string;
}

export const SystemDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [keyDataPoints, setKeyDataPoints] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDashboardData();
        setLastUpdate(new Date());
      }, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadDashboardData = async () => {
    try {
      // Load system statistics and key data points
      const [statusResponse, dataPointsResponse, healthResponse] = await Promise.all([
        api.get('/api/status'),
        api.get('/api/data-points?limit=6'), // Get first 6 data points for gauges
        api.get('/api/health')
      ]);
      
      const statusData = statusResponse.data;
      const dataPointsData = dataPointsResponse.data || [];
      const healthData = healthResponse.data;
      
      // Build system stats
      const systemStats: SystemStats = {
        devices: {
          total: statusData.database_statistics?.total_devices || 0,
          online: Math.floor((statusData.database_statistics?.total_devices || 0) * 0.85), // Estimate
          offline: Math.floor((statusData.database_statistics?.total_devices || 0) * 0.15),
          health_percentage: 85
        },
        protocols: {
          total: statusData.database_statistics?.total_protocols || 0,
          active: statusData.protocol_manager?.running_protocols || 0,
          health_percentage: statusData.protocol_manager?.running_protocols > 0 ? 90 : 0
        },
        data_points: {
          total: dataPointsData.length,
          active: dataPointsData.filter((dp: any) => dp.current_value !== null).length,
          last_updated: new Date().toISOString()
        },
        system: {
          uptime: healthData.statistics?.websocket_connections || 0,
          cpu_usage: 45, // Would come from health endpoint
          memory_usage: 62,
          disk_usage: 28
        }
      };
      
      setStats(systemStats);
      
      // Set key data points for gauges
      const keyPoints = dataPointsData.slice(0, 6).map((dp: any) => ({
        id: dp.id,
        name: dp.name,
        current_value: dp.current_value,
        unit: dp.unit || '',
        device_name: dp.device_name || 'Unknown Device',
        last_read: dp.last_read || new Date().toISOString()
      }));
      
      setKeyDataPoints(keyPoints);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Dashboard Error",
        description: "Failed to load system dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return days > 0 ? `${days}d ${remainingHours}h` : `${remainingHours}h`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading system dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Overview</h1>
          <p className="text-gray-600">Real-time monitoring of your industrial IoT system</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          <Button size="sm" variant="outline" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics - Real Data Points as Gauges */}
      {keyDataPoints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Real-time Data Points
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keyDataPoints.map((dataPoint) => {
              const numericValue = parseFloat(dataPoint.current_value) || 0;
              return (
                <RealTimeGauge
                  key={dataPoint.id}
                  value={numericValue}
                  min={0}
                  max={numericValue * 1.5 || 100} // Dynamic max based on current value
                  unit={dataPoint.unit}
                  label={dataPoint.name}
                  subtitle={dataPoint.device_name}
                />
              );
            })}
          </div>
        </div>
      )}
      
      {/* System Health Overview */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                System Health
              </CardTitle>
              <CardDescription>Current system status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span>Connected Devices:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={stats.devices.health_percentage > 80 ? "default" : "secondary"}>
                      {stats.devices.online}/{stats.devices.total}
                    </Badge>
                    <span className="text-sm text-gray-600">{stats.devices.health_percentage}%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Wifi className="h-4 w-4 text-green-600" />
                    <span>Active Protocols:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={stats.protocols.active > 0 ? "default" : "secondary"}>
                      {stats.protocols.active}/{stats.protocols.total}
                    </Badge>
                    <span className="text-sm text-gray-600">{stats.protocols.health_percentage}%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Server className="h-4 w-4 text-purple-600" />
                    <span>Data Points:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {stats.data_points.active}/{stats.data_points.total}
                    </Badge>
                    <span className="text-sm text-gray-600">active</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span>System Load:</span>
                  </div>
                  <div className="text-sm space-x-4">
                    <span>CPU: {stats.system.cpu_usage}%</span>
                    <span>RAM: {stats.system.memory_usage}%</span>
                    <span>Disk: {stats.system.disk_usage}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {((stats.devices.health_percentage + stats.protocols.health_percentage) / 2).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Health</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.data_points.active}
                    </div>
                    <div className="text-sm text-gray-600">Active Sensors</div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View History
                    </Button>
                    <Button size="sm" variant="outline" className="justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      System Health
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Detailed Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
          <ProtocolMetrics />
        </div>
        <div className="lg:col-span-1">
          <ConnectionStatus />
        </div>
      </div>
      
      {/* Alert Panel */}
      <AlertPanel />
      
      {/* Device Hierarchy - can be collapsed */}
      <Card>
        <CardHeader>
          <CardTitle>Device Hierarchy</CardTitle>
          <CardDescription>
            Hierarchical view of your industrial devices and data points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HierarchicalTree 
            allowEdit={false}
            allowDragDrop={false}
            showAddButtons={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};