import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Server, 
  Database, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Activity,
  Clock,
  Zap,
  AlertCircle
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  response_time_ms: number;
  error?: string;
  details?: Record<string, any>;
  checked_at: string;
}

interface HealthOverview {
  overall_status: string;
  timestamp: string;
  services: ServiceHealth[];
  summary: {
    total_services: number;
    healthy: number;
    warning: number;
    critical: number;
    health_score: number;
  };
  recent_issues?: Array<{
    id: string;
    level: string;
    component: string;
    message: string;
    created_at: string;
    metadata?: Record<string, any>;
  }>;
}

export function HealthCheck() {
  const [healthData, setHealthData] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    loadHealthData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadHealthData();
        setLastUpdate(new Date());
      }, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadHealthData = async () => {
    try {
      const response = await api.get('/api/health/detailed');
      setHealthData(response.data);
    } catch (error) {
      console.error('Error loading health data:', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to fetch system health status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testService = async (serviceName: string) => {
    try {
      await api.post(`/api/health/test/${serviceName.toLowerCase().replace(' ', '_')}`);
      await loadHealthData();
      toast({
        title: "Service Tested",
        description: `${serviceName} health check completed`
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: `Failed to test ${serviceName}`,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase();
    if (name.includes('mongodb')) return <Database className="h-4 w-4" />;
    if (name.includes('redis')) return <Server className="h-4 w-4" />;
    if (name.includes('system')) return <Cpu className="h-4 w-4" />;
    if (name.includes('protocol')) return <Wifi className="h-4 w-4" />;
    if (name.includes('n8n')) return <Zap className="h-4 w-4" />;
    if (name.includes('ollama')) return <Activity className="h-4 w-4" />;
    return <Server className="h-4 w-4" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading system health...</div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Health Check Unavailable</h3>
          <p className="text-gray-600 mb-4">Unable to retrieve system health status</p>
          <Button onClick={loadHealthData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              {getStatusIcon(healthData.overall_status)}
              <span className="ml-2">System Health Overview</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
              </Button>
              <Button size="sm" variant="outline" onClick={loadHealthData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Last updated: {lastUpdate.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{healthData.summary.healthy}</div>
              <div className="text-sm text-gray-600">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{healthData.summary.warning}</div>
              <div className="text-sm text-gray-600">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{healthData.summary.critical}</div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{healthData.summary.health_score}%</div>
              <div className="text-sm text-gray-600">Health Score</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Health Score</span>
              <span>{healthData.summary.health_score}%</span>
            </div>
            <Progress value={healthData.summary.health_score} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services Status</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Service Health Status</CardTitle>
              <CardDescription>
                Detailed status of all system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthData.services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getServiceIcon(service.name)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{service.name}</h4>
                          {getStatusBadge(service.status)}
                        </div>
                        {service.error && (
                          <p className="text-sm text-red-600 mt-1">{service.error}</p>
                        )}
                        {service.response_time_ms > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Response time: {service.response_time_ms.toFixed(0)}ms
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {service.details && Object.keys(service.details).length > 0 && (
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {Object.entries(service.details).slice(0, 3).map(([key, value]) => (
                            <div key={key} className="flex justify-between space-x-4">
                              <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="font-mono">
                                {typeof value === 'number' && key.includes('percent') 
                                  ? `${value}%`
                                  : typeof value === 'number' && key.includes('mb')
                                  ? `${value} MB`
                                  : typeof value === 'number' && key.includes('seconds')
                                  ? formatUptime(value)
                                  : String(value)
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => testService(service.name)}
                        className="mt-2"
                      >
                        Test
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent System Issues</CardTitle>
              <CardDescription>
                Error and warning logs from the last hour
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!healthData.recent_issues || healthData.recent_issues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600">No recent issues found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto">
                  {healthData.recent_issues.map((issue) => (
                    <div key={issue.id} className={`p-3 border-l-4 rounded ${
                      issue.level === 'error' 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-yellow-400 bg-yellow-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {issue.level === 'error' 
                            ? <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            : <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          }
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm">{issue.component}</span>
                              <Badge variant={issue.level === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                                {issue.level}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{issue.message}</p>
                            {issue.metadata && Object.keys(issue.metadata).length > 0 && (
                              <div className="text-xs text-gray-600 mt-2">
                                {Object.entries(issue.metadata).map(([key, value]) => (
                                  <div key={key}>
                                    <strong>{key}:</strong> {String(value)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(issue.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid gap-4">
            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="h-5 w-5 mr-2" />
                  System Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const systemService = healthData.services.find(s => s.name === 'System Resources');
                  if (!systemService?.details) return <p className="text-gray-500">No system data available</p>;
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">CPU Usage</span>
                          <span className="text-sm">{systemService.details.cpu_percent}%</span>
                        </div>
                        <Progress value={systemService.details.cpu_percent} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Memory Usage</span>
                          <span className="text-sm">{systemService.details.memory_percent}%</span>
                        </div>
                        <Progress value={systemService.details.memory_percent} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Disk Usage</span>
                          <span className="text-sm">{systemService.details.disk_percent}%</span>
                        </div>
                        <Progress value={systemService.details.disk_percent} className="h-2" />
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Database Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const mongoService = healthData.services.find(s => s.name === 'MongoDB');
                  if (!mongoService?.details) return <p className="text-gray-500">No database data available</p>;
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold">{mongoService.details.collections}</div>
                        <div className="text-sm text-gray-600">Collections</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{mongoService.details.data_size_mb} MB</div>
                        <div className="text-sm text-gray-600">Data Size</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">{mongoService.details.connections}</div>
                        <div className="text-sm text-gray-600">Connections</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {formatUptime(mongoService.details.uptime_seconds)}
                        </div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Protocol Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wifi className="h-5 w-5 mr-2" />
                  Industrial Protocols
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const protocolService = healthData.services.find(s => s.name === 'Industrial Protocols');
                  if (!protocolService?.details) return <p className="text-gray-500">No protocol data available</p>;
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {protocolService.details.active_protocols}/{protocolService.details.total_protocols}
                        </div>
                        <div className="text-sm text-gray-600">Active Protocols</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {protocolService.details.online_devices}/{protocolService.details.total_devices}
                        </div>
                        <div className="text-sm text-gray-600">Online Devices</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {protocolService.details.active_connections}
                        </div>
                        <div className="text-sm text-gray-600">Active Connections</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {protocolService.details.protocol_health_percent}%
                        </div>
                        <div className="text-sm text-gray-600">Health Score</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}