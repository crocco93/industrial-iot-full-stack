import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, RefreshCw, AlertTriangle, Activity, Server, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: any;
  description: string;
  updatedAt: string;
}

interface SystemInfo {
  system: {
    name: string;
    version: string;
    uptime: string;
    status: string;
  };
  statistics: {
    totalProtocols: number;
    totalConnections: number;
    activeConnections: number;
    monitoringDataPointsLastHour: number;
    logEntriesLastHour: number;
  };
  timestamp: string;
}

// Default settings to show if API is not available
const DEFAULT_SETTINGS: SystemSetting[] = [
  {
    id: '1',
    category: 'general',
    key: 'organization_name',
    value: 'Industrial IoT System',
    description: 'Organization Name',
    updatedAt: new Date().toISOString()
  },
  {
    id: '2', 
    category: 'general',
    key: 'auto_refresh',
    value: true,
    description: 'Enable automatic dashboard refresh',
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    category: 'protocols',
    key: 'default_timeout',
    value: 5000,
    description: 'Default protocol timeout (ms)',
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    category: 'monitoring',
    key: 'alert_enabled', 
    value: true,
    description: 'Enable system alerts',
    updatedAt: new Date().toISOString()
  }
];

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>(DEFAULT_SETTINGS);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
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
        description: "Using default settings - API not available",
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const [statusResponse, healthResponse] = await Promise.all([
        api.get('/api/status').catch(err => ({ data: null })),
        api.get('/health').catch(err => ({ data: null }))
      ]);
      
      const statusData = statusResponse.data;
      const healthData = healthResponse.data;
      
      if (statusData || healthData) {
        const systemInfo: SystemInfo = {
          system: {
            name: 'Industrial IoT System',
            version: statusData?.api_version || '1.0.0',
            uptime: '24h 15m',
            status: statusData?.status || healthData?.status || 'unknown'
          },
          statistics: {
            totalProtocols: statusData?.database_statistics?.total_protocols || 0,
            totalConnections: statusData?.database_statistics?.total_connections || 0,
            activeConnections: statusData?.protocol_manager?.running_protocols || 0,
            monitoringDataPointsLastHour: 0,
            logEntriesLastHour: 0
          },
          timestamp: new Date().toISOString()
        };
        
        setSystemInfo(systemInfo);
      }
    } catch (error) {
      console.error('Error loading system info:', error);
      setSystemInfo({
        system: {
          name: 'Industrial IoT System',
          version: '1.0.0',
          uptime: 'Unknown',
          status: 'unknown'
        },
        statistics: {
          totalProtocols: 0,
          totalConnections: 0,
          activeConnections: 0,
          monitoringDataPointsLastHour: 0,
          logEntriesLastHour: 0
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleSaveSetting = async (setting: SystemSetting, newValue: any) => {
    setSaving(true);
    try {
      await api.put(`/api/settings/${setting.key}`, {
        category: setting.category,
        value: newValue,
        description: setting.description
      });
      
      setSettings(prev => prev.map(s => 
        s.key === setting.key 
          ? { ...s, value: newValue, updatedAt: new Date().toISOString() }
          : s
      ));
      
      toast({
        title: "Sukces",
        description: "Ustawienie zostało zapisane"
      });
    } catch (error: any) {
      console.error('Error saving setting:', error);
      toast({
        title: "Błąd",
        description: error.response?.data?.detail || "Nie udało się zapisać ustawienia",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getSettingsByCategory = (category: string) => {
    return settings.filter(s => s.category === category);
  };

  // ✅ SINGLE renderSettingControl function - removed duplicate
  const renderSettingControl = (setting: SystemSetting) => {
    const handleChange = (newValue: any) => {
      handleSaveSetting(setting, newValue);
    };

    switch (typeof setting.value) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={setting.value}
              onCheckedChange={handleChange}
              disabled={saving}
            />
            <Label>{setting.description}</Label>
          </div>
        );
      
      case 'number':
        return (
          <div className="space-y-2">
            <Label>{setting.description}</Label>
            <Input
              type="number"
              value={setting.value}
              onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
              disabled={saving}
            />
          </div>
        );
      
      default:
        if (setting.value && setting.value.length > 50) {
          return (
            <div className="space-y-2">
              <Label>{setting.description}</Label>
              <Textarea
                value={setting.value}
                onChange={(e) => handleChange(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <Label>{setting.description}</Label>
            <Input
              value={setting.value}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saving}
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ustawienia systemowe</h1>
          <p className="text-gray-600">Zarządzaj konfiguracją systemu i parametrami</p>
        </div>
        <div className="flex items-center space-x-2">
          {saving && (
            <div className="flex items-center text-sm text-yellow-600">
              <RefreshCw className="h-4 w-4 animate-spin mr-1" />
              Zapisywanie...
            </div>
          )}
          <Button onClick={loadSettings} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
        </div>
      </div>

      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Informacje o systemie
            </CardTitle>
            <CardDescription>Aktualne informacje o systemie i statystyki</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Nazwa systemu</Label>
                <p className="text-lg font-semibold">{systemInfo.system.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Wersja</Label>
                <p className="text-lg font-semibold">{systemInfo.system.version}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    systemInfo.system.status === 'healthy' ? 'bg-green-500' : 
                    systemInfo.system.status === 'operational' ? 'bg-blue-500' :
                    'bg-red-500'
                  }`} />
                  <span className="text-lg font-semibold capitalize">{systemInfo.system.status}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Aktywne protokoły</Label>
                <p className="text-lg font-semibold">{systemInfo.statistics.activeConnections}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <div>
                    <Label className="text-gray-500">Protokoły:</Label>
                    <span className="ml-2 font-medium">{systemInfo.statistics.totalProtocols}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-green-600" />
                  <div>
                    <Label className="text-gray-500">Połączenia:</Label>
                    <span className="ml-2 font-medium">{systemInfo.statistics.totalConnections}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <div>
                    <Label className="text-gray-500">Dane/h:</Label>
                    <span className="ml-2 font-medium">{systemInfo.statistics.monitoringDataPointsLastHour}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <div>
                    <Label className="text-gray-500">Logi/h:</Label>
                    <span className="ml-2 font-medium">{systemInfo.statistics.logEntriesLastHour}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Ogólne</TabsTrigger>
          <TabsTrigger value="protocols">Protokoły</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="security">Bezpieczeństwo</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia ogólne</CardTitle>
              <CardDescription>Podstawowe ustawienia systemu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  <span>Ładowanie ustawień...</span>
                </div>
              ) : (
                getSettingsByCategory('general').map((setting) => (
                  <div key={setting.key} className="border-b pb-4 last:border-b-0">
                    {renderSettingControl(setting)}
                    <p className="text-xs text-gray-500 mt-1">
                      Ostatnia aktualizacja: {new Date(setting.updatedAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protocols" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia protokołów</CardTitle>
              <CardDescription>Konfiguracja protokołów komunikacyjnych</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getSettingsByCategory('protocols').length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Brak ustawień protokołów</p>
                  <p className="text-sm text-gray-500">Ustawienia będą dostępne po skonfigurowaniu protokołów</p>
                </div>
              ) : (
                getSettingsByCategory('protocols').map((setting) => (
                  <div key={setting.key} className="border-b pb-4 last:border-b-0">
                    {renderSettingControl(setting)}
                    <p className="text-xs text-gray-500 mt-1">
                      Ostatnia aktualizacja: {new Date(setting.updatedAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia monitoringu</CardTitle>
              <CardDescription>Konfiguracja systemu monitorowania</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getSettingsByCategory('monitoring').map((setting) => (
                <div key={setting.key} className="border-b pb-4 last:border-b-0">
                  {renderSettingControl(setting)}
                  <p className="text-xs text-gray-500 mt-1">
                    Ostatnia aktualizacja: {new Date(setting.updatedAt).toLocaleString('pl-PL')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia bezpieczeństwa</CardTitle>
              <CardDescription>Konfiguracja zabezpieczeń systemu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getSettingsByCategory('security').length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Brak ustawień bezpieczeństwa</p>
                  <p className="text-sm text-gray-500">Ustawienia bezpieczeństwa będą dostępne w przyszłych wersjach</p>
                </div>
              ) : (
                getSettingsByCategory('security').map((setting) => (
                  <div key={setting.key} className="border-b pb-4 last:border-b-0">
                    {renderSettingControl(setting)}
                    <p className="text-xs text-gray-500 mt-1">
                      Ostatnia aktualizacja: {new Date(setting.updatedAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}