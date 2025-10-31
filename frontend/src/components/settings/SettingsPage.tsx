import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { api } from '../services/api';

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

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
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
      setSettings(response.data || []);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować ustawień",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await api.get('/api/system/info');
      setSystemInfo(response.data);
    } catch (error) {
      console.error('Error loading system info:', error);
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
        description: "Ustawienie zostało zapisane",
      });
    } catch (error) {
      console.error('Error saving setting:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać ustawienia",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getSettingsByCategory = (category: string) => {
    return settings.filter(s => s.category === category);
  };

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
              onChange={(e) => handleChange(parseFloat(e.target.value))}
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
        <Button onClick={loadSettings}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Odśwież
        </Button>
      </div>

      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Informacje o systemie</CardTitle>
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
                    systemInfo.system.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-lg font-semibold">{systemInfo.system.status}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Aktywne protokoły</Label>
                <p className="text-lg font-semibold">{systemInfo.statistics.activeConnections}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-gray-500">Protokoły:</Label>
                  <span className="ml-2">{systemInfo.statistics.totalProtocols}</span>
                </div>
                <div>
                  <Label className="text-gray-500">Połączenia:</Label>
                  <span className="ml-2">{systemInfo.statistics.totalConnections}</span>
                </div>
                <div>
                  <Label className="text-gray-500">Dane/h:</Label>
                  <span className="ml-2">{systemInfo.statistics.monitoringDataPointsLastHour}</span>
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
                <div>Ładowanie ustawień...</div>
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
              {getSettingsByCategory('protocols').map((setting) => (
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
              {getSettingsByCategory('security').map((setting) => (
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
      </Tabs>
    </div>
  );
}
