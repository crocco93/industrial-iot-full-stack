import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Database, 
  Shield, 
  Bell, 
  Clock, 
  Monitor,
  Save,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { HealthCheck } from './HealthCheck';

interface SystemSettings {
  // General Settings
  organization_name: string;
  location: string;
  timezone: string;
  language: string;
  
  // Database Settings
  data_retention_days: number;
  backup_enabled: boolean;
  backup_frequency_hours: number;
  
  // Security Settings
  session_timeout_minutes: number;
  password_policy_enabled: boolean;
  api_rate_limit: number;
  encryption_enabled: boolean;
  
  // Monitoring Settings
  alert_email_enabled: boolean;
  alert_webhook_url: string;
  log_level: string;
  metrics_collection_enabled: boolean;
  
  // Communication Settings
  default_read_frequency_ms: number;
  connection_timeout_seconds: number;
  retry_attempts: number;
  websocket_heartbeat_seconds: number;
  
  // UI Settings
  theme: string;
  auto_refresh_enabled: boolean;
  refresh_interval_seconds: number;
  dashboard_layout: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  organization_name: 'Industrial IoT System',
  location: 'Main Factory',
  timezone: 'Europe/Warsaw',
  language: 'pl',
  data_retention_days: 365,
  backup_enabled: true,
  backup_frequency_hours: 24,
  session_timeout_minutes: 480,
  password_policy_enabled: true,
  api_rate_limit: 1000,
  encryption_enabled: true,
  alert_email_enabled: false,
  alert_webhook_url: '',
  log_level: 'info',
  metrics_collection_enabled: true,
  default_read_frequency_ms: 1000,
  connection_timeout_seconds: 30,
  retry_attempts: 3,
  websocket_heartbeat_seconds: 30,
  theme: 'light',
  auto_refresh_enabled: true,
  refresh_interval_seconds: 30,
  dashboard_layout: 'grid'
};

export function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/settings');
      setSettings(response.data || DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(DEFAULT_SETTINGS);
      toast({
        title: "Settings Loaded",
        description: "Using default settings - save to persist changes",
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', settings);
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully"
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: error.response?.data?.detail || "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(true);
      toast({
        title: "Settings Reset",
        description: "All settings have been reset to defaults"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-gray-600">Configure system behavior and preferences</p>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>
          <Button onClick={saveSettings} disabled={saving || !hasChanges}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="healthcheck">Health Check</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                General Settings
              </CardTitle>
              <CardDescription>
                Basic system configuration and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={settings.organization_name}
                    onChange={(e) => updateSetting('organization_name', e.target.value)}
                    placeholder="Your Organization Name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="location">Primary Location</Label>
                  <Input
                    id="location"
                    value={settings.location}
                    onChange={(e) => updateSetting('location', e.target.value)}
                    placeholder="Main Factory, Plant 1, etc."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => updateSetting('timezone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Warsaw">Europe/Warsaw (CET)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="America/Chicago">America/Chicago (CST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={settings.language} onValueChange={(value) => updateSetting('language', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pl">Polski</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Interface Settings
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={settings.theme} onValueChange={(value) => updateSetting('theme', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="refresh-interval">Auto Refresh (seconds)</Label>
                    <Input
                      id="refresh-interval"
                      type="number"
                      min="5"
                      max="300"
                      value={settings.refresh_interval_seconds}
                      onChange={(e) => updateSetting('refresh_interval_seconds', parseInt(e.target.value) || 30)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.auto_refresh_enabled}
                    onCheckedChange={(checked) => updateSetting('auto_refresh_enabled', checked)}
                  />
                  <Label>Enable auto-refresh for real-time data</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Database Settings
              </CardTitle>
              <CardDescription>
                Configure data storage and backup options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="retention">Data Retention Period (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  min="1"
                  max="3650"
                  value={settings.data_retention_days}
                  onChange={(e) => updateSetting('data_retention_days', parseInt(e.target.value) || 365)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Historical data older than this will be automatically deleted
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium">Backup Configuration</h3>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.backup_enabled}
                    onCheckedChange={(checked) => updateSetting('backup_enabled', checked)}
                  />
                  <Label>Enable automatic backups</Label>
                </div>
                
                {settings.backup_enabled && (
                  <div>
                    <Label htmlFor="backup-frequency">Backup Frequency (hours)</Label>
                    <Select 
                      value={settings.backup_frequency_hours.toString()} 
                      onValueChange={(value) => updateSetting('backup_frequency_hours', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Every Hour</SelectItem>
                        <SelectItem value="6">Every 6 Hours</SelectItem>
                        <SelectItem value="12">Every 12 Hours</SelectItem>
                        <SelectItem value="24">Daily</SelectItem>
                        <SelectItem value="168">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure authentication and access control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Select 
                  value={settings.session_timeout_minutes.toString()} 
                  onValueChange={(value) => updateSetting('session_timeout_minutes', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.password_policy_enabled}
                    onCheckedChange={(checked) => updateSetting('password_policy_enabled', checked)}
                  />
                  <Label>Enforce strong password policy</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.encryption_enabled}
                    onCheckedChange={(checked) => updateSetting('encryption_enabled', checked)}
                  />
                  <Label>Enable data encryption at rest</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="rate-limit">API Rate Limit (requests/hour)</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min="100"
                  max="10000"
                  value={settings.api_rate_limit}
                  onChange={(e) => updateSetting('api_rate_limit', parseInt(e.target.value) || 1000)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Monitoring & Alerts
              </CardTitle>
              <CardDescription>
                Configure system monitoring and alert notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Alert Notifications</h3>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.alert_email_enabled}
                    onCheckedChange={(checked) => updateSetting('alert_email_enabled', checked)}
                  />
                  <Label>Enable email alerts</Label>
                </div>
                
                <div>
                  <Label htmlFor="webhook-url">Alert Webhook URL (optional)</Label>
                  <Input
                    id="webhook-url"
                    value={settings.alert_webhook_url}
                    onChange={(e) => updateSetting('alert_webhook_url', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Send alerts to Slack, Teams, or other webhook endpoints
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-medium">Logging Configuration</h3>
                
                <div>
                  <Label htmlFor="log-level">Log Level</Label>
                  <Select value={settings.log_level} onValueChange={(value) => updateSetting('log_level', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug (Verbose)</SelectItem>
                      <SelectItem value="info">Info (Normal)</SelectItem>
                      <SelectItem value="warning">Warning (Important)</SelectItem>
                      <SelectItem value="error">Error (Critical Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.metrics_collection_enabled}
                    onCheckedChange={(checked) => updateSetting('metrics_collection_enabled', checked)}
                  />
                  <Label>Enable performance metrics collection</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Communication Settings
              </CardTitle>
              <CardDescription>
                Configure protocol communication parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="read-frequency">Default Read Frequency (ms)</Label>
                  <Select 
                    value={settings.default_read_frequency_ms.toString()} 
                    onValueChange={(value) => updateSetting('default_read_frequency_ms', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100ms - Very Fast</SelectItem>
                      <SelectItem value="500">500ms - Fast</SelectItem>
                      <SelectItem value="1000">1000ms - Normal</SelectItem>
                      <SelectItem value="5000">5000ms - Slow</SelectItem>
                      <SelectItem value="10000">10000ms - Very Slow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="timeout">Connection Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="1"
                    max="300"
                    value={settings.connection_timeout_seconds}
                    onChange={(e) => updateSetting('connection_timeout_seconds', parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    min="0"
                    max="10"
                    value={settings.retry_attempts}
                    onChange={(e) => updateSetting('retry_attempts', parseInt(e.target.value) || 3)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="heartbeat">WebSocket Heartbeat (seconds)</Label>
                  <Input
                    id="heartbeat"
                    type="number"
                    min="5"
                    max="300"
                    value={settings.websocket_heartbeat_seconds}
                    onChange={(e) => updateSetting('websocket_heartbeat_seconds', parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <strong>Note:</strong> Lower frequencies provide more real-time data but increase system load. 
                    Adjust based on your network capacity and monitoring requirements.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="healthcheck">
          <HealthCheck />
        </TabsContent>
      </Tabs>
    </div>
  );
}