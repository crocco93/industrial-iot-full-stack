import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  device_id?: string;
  device_name?: string;
  protocol_type?: string;
  created_at: string;
  updated_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

export const AlertPanel: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
    
    // Refresh alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await api.get('/api/monitoring/alerts?limit=10&resolved=false');
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
      // Fallback to system logs if alerts endpoint doesn't exist
      try {
        const logsResponse = await api.get('/api/logs?level=error&level=warning&limit=10');
        const logs = logsResponse.data || [];
        const alertsFromLogs = logs.map((log: any) => ({
          id: log.id,
          type: log.level === 'error' ? 'error' : 'warning',
          severity: log.level === 'error' ? 'high' : 'medium',
          title: log.component || 'System Alert',
          message: log.message,
          device_name: log.metadata?.device_name,
          protocol_type: log.metadata?.protocol_type,
          created_at: log.created_at,
          updated_at: log.updated_at,
          acknowledged: false,
          resolved: false
        }));
        setAlerts(alertsFromLogs);
      } catch (fallbackError) {
        console.error('Error loading system logs:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await api.post(`/api/monitoring/alerts/${alertId}/acknowledge`);
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString() }
          : alert
      ));
      toast({
        title: "Alert acknowledged",
        description: "Alert has been acknowledged"
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive"
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await api.post(`/api/monitoring/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      toast({
        title: "Alert resolved",
        description: "Alert has been resolved and removed"
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive"
      });
    }
  };

  const getAlertColor = (type: string, severity: string) => {
    if (type === 'error' || severity === 'critical') return 'border-red-400 bg-red-50';
    if (type === 'warning' || severity === 'high') return 'border-yellow-400 bg-yellow-50';
    if (type === 'info') return 'border-blue-400 bg-blue-50';
    if (type === 'success') return 'border-green-400 bg-green-50';
    return 'border-gray-400 bg-gray-50';
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'info': return <Info className="h-5 w-5 text-blue-600" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      default: return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          System Alerts
          <Badge variant="secondary">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-600">Loading alerts...</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-auto">
            {alerts.map(alert => (
              <div key={alert.id} className={`flex items-start space-x-3 p-3 rounded border-l-4 ${getAlertColor(alert.type, alert.severity)}`}>
                <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <div className="font-medium text-sm truncate">{alert.title}</div>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{alert.message}</p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-gray-500">
                      {alert.device_name && (
                        <span className="mr-2">🔧 {alert.device_name}</span>
                      )}
                      {alert.protocol_type && (
                        <span>📡 {alert.protocol_type}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{formatTimeAgo(alert.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  {!alert.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-xs px-2 py-1 h-7"
                    >
                      Acknowledge
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs px-2 py-1 h-7"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};