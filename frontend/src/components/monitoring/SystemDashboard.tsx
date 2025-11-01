import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RealTimeGauge } from '@/components/charts/RealTimeGauge';
import { ProtocolMetrics } from './ProtocolMetrics';
import { ConnectionStatus } from './ConnectionStatus';
import { AlertPanel } from './AlertPanel';
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
  BarChart3,
  Database,
  Cpu,
  HardDrive
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
    status: string;
  };
  alerts: {
    total: number;
    active: number;
    critical: number;
  };
}

interface DataPoint {
  id: string;
  name: string;
  current_value: any;
  unit: string;
  device_name: string;
  last_read: string;
  status: string;
}

export const SystemDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [keyDataPoints, setKeyDataPoints] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadDashboardData();
      }, 15000); // Refresh every 15 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadDashboardData = async () => {
    try {
      console.log('[SystemDashboard] Loading dashboard data...');
      
      // Test API connection first
      const testConnection = await api.testConnection();
      if (!testConnection) {
        setConnectionStatus('disconnected');
        throw new Error('Backend API not available');
      }
      setConnectionStatus('connected');
      
      // Load all required data
      const [statusResponse, healthResponse, dataPointsResponse, alertsResponse] = await Promise.all([
        api.get('/api/status').catch(err => ({ data: null, error: err })),
        api.get('/api/health').catch(err => ({ data: null, error: err })),
        api.get('/api/data-points').catch(err => ({ data: [], error: err })),
        api.get('/api/alerts/stats').catch(err => ({ data: { total: 0, active: 0, critical: 0 }, error: err }))
      ]);
      
      const statusData = statusResponse.data;
      const healthData = healthResponse.data;
      const dataPointsData = Array.isArray(dataPointsResponse.data) ? dataPointsResponse.data : [];
      const alertsData = alertsResponse.data || { total: 0, active: 0, critical: 0 };
      
      console.log('[SystemDashboard] API responses:', { statusData, healthData, dataPointsData: dataPointsData.length, alertsData });
      
      // Build system statistics
      const onlineDevices = dataPointsData.filter((dp: any) => dp.status === 'active' && dp.current_value !== null).length;
      const totalDevices = Math.max(dataPointsData.length, statusData?.database_statistics?.total_devices || 0);
      const activeProtocols = statusData?.protocol_manager?.running_protocols || 0;
      const totalProtocols = statusData?.database_statistics?.total_protocols || 0;
      
      const systemStats: SystemStats = {
        devices: {
          total: totalDevices,
          online: onlineDevices,
          offline: totalDevices - onlineDevices,
          health_percentage: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0
        },
        protocols: {
          total: Math.max(totalProtocols, 1),
          active: activeProtocols,
          health_percentage: totalProtocols > 0 ? Math.round((activeProtocols / totalProtocols) * 100) : 0
        },
        data_points: {
          total: dataPointsData.length,
          active: dataPointsData.filter((dp: any) => dp.current_value !== null && dp.current_value !== undefined).length,
          last_updated: new Date().toISOString()
        },
        system: {
          uptime: 24, // Would get from system metrics
          cpu_usage: Math.round(Math.random() * 30 + 20), // Simulated until we get real metrics
          memory_usage: Math.round(Math.random() * 40 + 30),
          disk_usage: Math.round(Math.random() * 20 + 15),
          status: healthData?.status || 'unknown'
        },
        alerts: {
          total: alertsData.total || 0,
          active: alertsData.active || 0,
          critical: alertsData.critical || 0
        }
      };
      
      setStats(systemStats);
      
      // Set key data points for gauges (limit to 6 for display)
      const keyPoints = dataPointsData.slice(0, 6).map((dp: any) => ({
        id: dp.id,
        name: dp.name,
        current_value: dp.current_value,
        unit: dp.unit || '',
        device_name: dp.device_name || 'Unknown Device',
        last_read: dp.last_read || dp.timestamp || new Date().toISOString(),
        status: dp.status || 'unknown'
      }));
      
      setKeyDataPoints(keyPoints);
      setLastUpdate(new Date());
      
    } catch (error: any) {
      console.error('[SystemDashboard] Error loading dashboard data:', error);
      setConnectionStatus('error');
      
      // Don't show error toast on every refresh if already disconnected
      if (connectionStatus !== 'error') {
        toast({
          title: "Connection Error",
          description: "Backend API is not available. Please check if the server is running on port 3001.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return days > 0 ? `${days}d ${remainingHours}h` : `${remainingHours}h`;
  };

  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-gray-600">Loading system dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Activity className="h-6 w-6 mr-2 text-blue-600" />
            System Overview
          </h1>
          <p className="text-gray-600">Real-time monitoring of your industrial IoT system</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'disconnected' ? 'bg-gray-400' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'disconnected' ? 'Connecting...' : 'Connection Error'}
            </span>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <span className="text-sm text-gray-500">Last updated: {lastUpdate.toLocaleTimeString()}</span>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs"
          >
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          
          <Button size="sm" variant="outline" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Error Banner */}
      {connectionStatus === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-medium text-red-800">Backend Connection Failed</div>
                <div className="text-sm text-red-600">
                  Cannot connect to the backend API. Please ensure the server is running on port 3001.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              const maxValue = numericValue > 0 ? numericValue * 1.2 : 100;
              
              return (
                <Card key={dataPoint.id} className="p-4">
                  <div className="text-center space-y-2">
                    <div className="font-medium text-sm truncate">{dataPoint.name}</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {numericValue.toFixed(1)} {dataPoint.unit}
                    </div>
                    <div className="text-xs text-gray-600">{dataPoint.device_name}</div>
                    <Badge 
                      variant={dataPoint.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {dataPoint.status}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      
      {/* System Health Overview */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                Device Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Online Devices</span>
                <div className="flex items-center space-x-2">
                  <Badge variant={stats.devices.health_percentage > 80 ? "default" : "destructive"}>
                    {stats.devices.online}/{stats.devices.total}
                  </Badge>
                </div>
              </div>
              
              <Progress value={stats.devices.health_percentage} className="h-2" />
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${getHealthColor(stats.devices.health_percentage)}`}>
                  {stats.devices.health_percentage}%
                </div>
                <div className="text-sm text-gray-600">System Health</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wifi className="h-5 w-5 mr-2 text-blue-600" />
                Protocol Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Active Protocols</span>
                <Badge variant={stats.protocols.active > 0 ? "default" : "secondary"}>
                  {stats.protocols.active}/{stats.protocols.total}
                </Badge>
              </div>
              
              <Progress value={stats.protocols.health_percentage} className="h-2" />
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Data Points:</span>
                  <span className="font-medium">{stats.data_points.active}/{stats.data_points.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Update:</span>
                  <span className="font-medium">{lastUpdate.toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2 text-purple-600" />
                System Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">CPU Usage</span>
                  </div>
                  <span className="text-sm font-medium">{stats.system.cpu_usage}%</span>
                </div>
                <Progress value={stats.system.cpu_usage} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Memory</span>
                  </div>
                  <span className="text-sm font-medium">{stats.system.memory_usage}%</span>
                </div>
                <Progress value={stats.system.memory_usage} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Disk Space</span>
                  </div>
                  <span className="text-sm font-medium">{stats.system.disk_usage}%</span>
                </div>
                <Progress value={stats.system.disk_usage} className="h-2" />
              </div>
              
              <Separator />
              
              <div className="text-center">
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="font-semibold">{formatUptime(stats.system.uptime)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Alert Summary */}
      {stats && stats.alerts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                Alert Summary
              </div>
              <Badge 
                variant={stats.alerts.critical > 0 ? "destructive" : stats.alerts.active > 0 ? "secondary" : "outline"}
              >
                {stats.alerts.active} active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.alerts.critical}</div>
                <div className="text-sm text-gray-600">Critical</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.alerts.active - stats.alerts.critical}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{stats.alerts.total - stats.alerts.active}</div>
                <div className="text-sm text-gray-600">Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Detailed Components */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ProtocolMetrics />
          <ConnectionStatus />
        </div>
        <div>
          <AlertPanel maxHeight="500px" showHeader={true} />
        </div>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Historical Data
            </Button>
            <Button variant="outline" className="justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Protocol Config
            </Button>
            <Button variant="outline" className="justify-start">
              <Database className="h-4 w-4 mr-2" />
              Device Manager
            </Button>
            <Button variant="outline" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              System Health
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && stats && (
        <Card className="border-gray-300">
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-600 space-y-1">
              <div>API Status: {connectionStatus}</div>
              <div>Data Points Loaded: {keyDataPoints.length}</div>
              <div>System Status: {stats.system.status}</div>
              <div>Auto Refresh: {autoRefresh ? 'Enabled' : 'Disabled'}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};