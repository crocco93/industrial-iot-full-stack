import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Activity, Zap } from 'lucide-react';
import { api } from '@/services/api';

interface DeviceConnection {
  id: string;
  name: string;
  device_type: 'infrastructure' | 'production';
  protocol_type: string;
  protocol_name: string;
  status: string;
  online: boolean;
  last_seen: string;
  address: string;
  response_time_ms: number;
  reliability_percent: number;
  bytes_transferred: number;
}

export const ConnectionStatus: React.FC = () => {
  const [devices, setDevices] = useState<DeviceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadConnections();
    
    // Refresh every 10 seconds for real-time status
    const interval = setInterval(() => {
      loadConnections();
      setLastUpdate(new Date());
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadConnections = async () => {
    try {
      // Get devices with connection info
      const devicesResponse = await api.get('/api/devices?limit=20');
      const connectionsResponse = await api.get('/api/connections');
      const protocolsResponse = await api.get('/api/protocols');
      
      const devices = devicesResponse.data || [];
      const connections = connectionsResponse.data || [];
      const protocols = protocolsResponse.data || [];
      
      // Map devices with connection status
      const deviceConnections: DeviceConnection[] = devices.map((device: any) => {
        const connection = connections.find((c: any) => c.id === device.connection_id);
        const protocol = protocols.find((p: any) => p.id === device.protocol_id);
        
        return {
          id: device.id,
          name: device.name,
          device_type: device.device_type || 'production',
          protocol_type: protocol?.type || 'unknown',
          protocol_name: protocol?.name || 'Unknown Protocol',
          status: device.status || 'inactive',
          online: device.online || false,
          last_seen: device.last_seen || device.updated_at,
          address: device.address || connection?.address || 'N/A',
          response_time_ms: device.average_response_time || connection?.response_time_ms || 0,
          reliability_percent: device.reliability_percent || connection?.connection_quality || 0,
          bytes_transferred: device.bytes_transferred || connection?.bytes_transferred || 0
        };
      });
      
      setDevices(deviceConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, online: boolean) => {
    if (online && status === 'active') {
      return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
    }
    if (status === 'error') {
      return <Badge className="bg-red-100 text-red-800">Error</Badge>;
    }
    if (status === 'maintenance') {
      return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Disconnected</Badge>;
  };

  const getDeviceIcon = (deviceType: string, protocolType: string) => {
    if (deviceType === 'infrastructure') {
      return <Zap className="h-4 w-4 text-blue-600" />;
    }
    return <Activity className="h-4 w-4 text-green-600" />;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Device Connections
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={loadConnections}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-600">Loading connections...</div>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8">
            <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No devices configured</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-auto">
            {devices.map((device) => (
              <div key={device.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded border">
                <div className="flex items-center space-x-3">
                  {getDeviceIcon(device.device_type, device.protocol_type)}
                  <div>
                    <div className="font-medium text-sm">{device.name}</div>
                    <div className="text-xs text-gray-500 flex items-center space-x-2">
                      <span>{device.protocol_name}</span>
                      <span>•</span>
                      <span>{device.address}</span>
                      {device.response_time_ms > 0 && (
                        <>
                          <span>•</span>
                          <span>{device.response_time_ms.toFixed(0)}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-1">
                    {getStatusBadge(device.status, device.online)}
                    {device.online && (
                      <Wifi className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Last: {formatTimeAgo(device.last_seen)}</div>
                    {device.reliability_percent > 0 && (
                      <div>Reliability: {device.reliability_percent.toFixed(1)}%</div>
                    )}
                    {device.bytes_transferred > 0 && (
                      <div>Data: {formatBytes(device.bytes_transferred)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};