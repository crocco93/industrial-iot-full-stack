import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  X, 
  Check,
  Filter,
  RefreshCw,
  Bell,
  BellOff,
  Clock,
  User
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved' | 'muted';
  source: string;
  source_type: string;
  source_name: string;
  category: string;
  data_point_id?: string;
  device_id?: string;
  protocol_id?: string;
  threshold_value?: number;
  current_value?: number;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  muted_until?: string;
  metadata: Record<string, any>;
}

interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  muted: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export const AlertPanel: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    category: 'all'
  });
  const { toast } = useToast();
  
  // WebSocket for real-time alert updates
  const { isConnected, lastMessage } = useWebSocket(
    `${import.meta.env.VITE_WS_URL || 'ws://localhost:3001'}/ws/alerts`,
    {
      onMessage: (data) => {
        if (data.type === 'alert_created') {
          setAlerts(prev => [data.alert, ...prev]);
          toast({
            title: `New ${data.alert.severity} Alert`,
            description: data.alert.title,
            variant: data.alert.severity === 'critical' ? 'destructive' : 'default'
          });
        } else if (data.type === 'alert_updated') {
          setAlerts(prev => prev.map(alert => 
            alert.id === data.alert.id ? data.alert : alert
          ));
        }
      }
    }
  );

  useEffect(() => {
    loadAlerts();
    loadStats();
  }, [filters]);

  const loadAlerts = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.severity !== 'all') params.append('severity', filters.severity);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.category !== 'all') params.append('category', filters.category);
      params.append('limit', '20');
      
      const response = await api.get(`/api/alerts?${params.toString()}`);
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
      toast({
        title: "Error",
        description: "Failed to load alerts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/alerts/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading alert stats:', error);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await api.put(`/api/alerts/${alertId}/acknowledge`, {
        acknowledged_by: 'current_user' // Would come from auth context
      });
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              status: 'acknowledged' as const,
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: 'current_user'
            }
          : alert
      ));
      toast({
        title: "Alert Acknowledged",
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
      await api.put(`/api/alerts/${alertId}/resolve`, {
        resolved_by: 'current_user'
      });
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      toast({
        title: "Alert Resolved",
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

  const muteAlert = async (alertId: string, hours: number = 1) => {
    try {
      await api.put(`/api/alerts/${alertId}/mute`, {
        duration_hours: hours
      });
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { 
              ...alert, 
              status: 'muted' as const,
              muted_until: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
            }
          : alert
      ));
      toast({
        title: "Alert Muted",
        description: `Alert muted for ${hours} hour${hours > 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error('Error muting alert:', error);
      toast({
        title: "Error",
        description: "Failed to mute alert",
        variant: "destructive"
      });
    }
  };

  const bulkAcknowledge = async () => {
    const selectedIds = Array.from(selectedAlerts);
    if (selectedIds.length === 0) return;
    
    try {
      await api.post('/api/alerts/bulk-acknowledge', {
        alert_ids: selectedIds,
        acknowledged_by: 'current_user'
      });
      
      setAlerts(prev => prev.map(alert => 
        selectedIds.includes(alert.id)
          ? { 
              ...alert, 
              status: 'acknowledged' as const,
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: 'current_user'
            }
          : alert
      ));
      
      setSelectedAlerts(new Set());
      toast({
        title: "Bulk Acknowledge",
        description: `Acknowledged ${selectedIds.length} alerts`
      });
    } catch (error) {
      console.error('Error bulk acknowledging alerts:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge selected alerts",
        variant: "destructive"
      });
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low': return <Info className="h-4 w-4 text-blue-600" />;
      case 'info': return <Info className="h-4 w-4 text-gray-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      case 'info': return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  return (
    <div className="space-y-4">
      {/* Alert Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{stats.by_severity.critical}</div>
            <div className="text-xs text-gray-600">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{stats.by_severity.high}</div>
            <div className="text-xs text-gray-600">High</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">{stats.by_severity.medium}</div>
            <div className="text-xs text-gray-600">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{stats.by_severity.low}</div>
            <div className="text-xs text-gray-600">Low</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{stats.by_severity.info}</div>
            <div className="text-xs text-gray-600">Info</div>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              System Alerts
              {isConnected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </div>
            <div className="flex items-center space-x-2">
              {selectedAlerts.size > 0 && (
                <Button size="sm" variant="outline" onClick={bulkAcknowledge}>
                  <Check className="h-4 w-4 mr-1" />
                  Ack ({selectedAlerts.size})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={loadAlerts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        {/* Filters */}
        <div className="px-6 pb-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <div className="flex space-x-2">
              <Select value={filters.severity} onValueChange={(value) => setFilters(prev => ({...prev, severity: value}))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({...prev, status: value}))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="muted">Muted</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({...prev, category: value}))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="connection">Connection</SelectItem>
                  <SelectItem value="threshold">Threshold</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-600">Loading alerts...</div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">No active alerts</p>
              <p className="text-sm text-gray-500">System is running normally</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {alerts.map(alert => (
                <div 
                  key={alert.id} 
                  className={`flex items-start space-x-3 p-3 rounded border-l-4 transition-colors ${
                    getSeverityColor(alert.severity)
                  } ${selectedAlerts.has(alert.id) ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <Checkbox
                    checked={selectedAlerts.has(alert.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedAlerts);
                      if (checked) {
                        newSelected.add(alert.id);
                      } else {
                        newSelected.delete(alert.id);
                      }
                      setSelectedAlerts(newSelected);
                    }}
                  />
                  
                  <div className="mt-0.5">{getAlertIcon(alert.severity)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="font-medium text-sm truncate">{alert.title}</div>
                      <Badge 
                        variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} 
                        className="text-xs"
                      >
                        {alert.severity.toUpperCase()}
                      </Badge>
                      
                      {alert.status === 'acknowledged' && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          <User className="h-2 w-2 mr-1" />
                          ACK
                        </Badge>
                      )}
                      
                      {alert.status === 'muted' && (
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          <BellOff className="h-2 w-2 mr-1" />
                          MUTED
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{alert.description}</p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex items-center space-x-3">
                        <span>🔌 {alert.source_name}</span>
                        <span className="capitalize">📂 {alert.category}</span>
                        {alert.current_value !== undefined && alert.threshold_value !== undefined && (
                          <span>📊 {alert.current_value} / {alert.threshold_value}</span>
                        )}
                      </div>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(alert.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-1">
                    {alert.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-xs px-2 py-1 h-6"
                          title="Acknowledge alert"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => muteAlert(alert.id, 1)}
                          className="text-xs px-2 py-1 h-6"
                          title="Mute for 1 hour"
                        >
                          <BellOff className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(alert.id)}
                      className="text-xs px-2 py-1 h-6 text-green-600 hover:text-green-800"
                      title="Resolve alert"
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
    </div>
  );
};