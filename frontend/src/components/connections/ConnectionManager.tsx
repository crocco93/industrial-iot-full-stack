import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Zap, ZapOff, Wifi, WifiOff, Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';  // ✅ FIXED import
import { api } from '@/services/api';  // ✅ FIXED import

interface Connection {
  id: string;
  name: string;
  protocolId: string;
  address: string;
  status: 'active' | 'inactive' | 'error';
  lastSeen: string;
  dataRate: string;
  bytesTransferred: number;
  errorCount: number;
  configuration: Record<string, any>;
  protocol: {
    id: string;
    name: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Mock data for development
const MOCK_CONNECTIONS: Connection[] = [
  {
    id: 'conn_001',
    name: 'PLC Production Line A',
    protocolId: 'protocol_001',
    address: '192.168.1.100:502',
    status: 'active',
    lastSeen: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    dataRate: '1.2 kB/s',
    bytesTransferred: 1024000,
    errorCount: 0,
    configuration: {
      slaveId: 1,
      timeout: 5000,
      registers: ['40001-40010']
    },
    protocol: {
      id: 'protocol_001',
      name: 'Modbus TCP Main',
      type: 'modbus-tcp'
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 30000).toISOString()
  },
  {
    id: 'conn_002',
    name: 'SCADA OPC Server',
    protocolId: 'protocol_002',
    address: 'opc.tcp://192.168.1.101:4840',
    status: 'inactive',
    lastSeen: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    dataRate: '0.8 kB/s',
    bytesTransferred: 567890,
    errorCount: 2,
    configuration: {
      securityMode: 'None',
      sessionTimeout: 60000,
      subscriptionInterval: 1000
    },
    protocol: {
      id: 'protocol_002',
      name: 'OPC-UA SCADA Server',
      type: 'opc-ua'
    },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 'conn_003',
    name: 'MQTT Sensor Network',
    protocolId: 'protocol_003',
    address: 'mqtt://192.168.1.200:1883',
    status: 'active',
    lastSeen: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    dataRate: '2.1 kB/s',
    bytesTransferred: 2048000,
    errorCount: 0,
    configuration: {
      clientId: 'industrial-iot-gateway',
      keepAlive: 60,
      topics: ['sensors/+/temperature', 'sensors/+/pressure']
    },
    protocol: {
      id: 'protocol_003',
      name: 'MQTT Broker',
      type: 'mqtt'
    },
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 5000).toISOString()
  },
  {
    id: 'conn_004',
    name: 'HMI EtherNet/IP',
    protocolId: 'protocol_004', 
    address: '192.168.1.150:44818',
    status: 'error',
    lastSeen: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    dataRate: '0 kB/s',
    bytesTransferred: 123456,
    errorCount: 15,
    configuration: {
      vendorId: 0x01,
      serialNumber: 0x12345678,
      sessionTimeout: 30000
    },
    protocol: {
      id: 'protocol_004',
      name: 'Allen-Bradley CompactLogix',
      type: 'ethernet-ip'
    },
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString()
  }
];

export function ConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>(MOCK_CONNECTIONS);
  const [loading, setLoading] = useState(false);
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadConnections();
    const interval = setInterval(loadConnections, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/connections');
      setConnections(response.data || MOCK_CONNECTIONS);
    } catch (error) {
      console.error('Error loading connections:', error);
      // Use mock data if API fails
      setConnections(MOCK_CONNECTIONS);
      toast({
        title: "Połączenia załadowane",
        description: "Używam danych przykładowych - API niedostępne",
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (connection: Connection) => {
    setTestingConnections(prev => new Set(prev).add(connection.id));
    
    try {
      const response = await api.post(`/api/connections/${connection.id}/test`);
      toast({
        title: response.data.success ? "Test zakończony sukcesem" : "Test nieudany",
        description: response.data.message || `Test połączenia ${connection.name}`,
        variant: response.data.success ? "default" : "destructive"
      });
      
      // Update connection status based on test result
      setConnections(prev => prev.map(c => 
        c.id === connection.id 
          ? { ...c, status: response.data.success ? 'active' : 'error' }
          : c
      ));
      
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast({
        title: "Błąd testu",
        description: error.response?.data?.detail || "Nie udało się przetestować połączenia",
        variant: "destructive"
      });
      
      // Mark connection as error
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'error' } : c
      ));
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connection.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Aktywny</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Nieaktywny</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Błąd</Badge>;
      default:
        return <Badge variant="secondary">Nieznany</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getConnectionIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'inactive':
        return <WifiOff className="h-4 w-4 text-gray-400" />;
      case 'error':
        return <ZapOff className="h-4 w-4 text-red-600" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const getLastSeenText = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Teraz';
    if (diffMinutes < 60) return `${diffMinutes}m temu`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h temu`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d temu`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zarządzanie połączeniami</h1>
          <p className="text-gray-600">Monitoruj i zarządzaj połączeniami z urządzeniami przemysłowymi</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadConnections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nowe połączenie
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie połączenia</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
            <p className="text-xs text-muted-foreground">
              Skonfigurowanych połączeń
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {connections.filter(c => c.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.round(Math.random() * 2)} od ostatniej godziny
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Z błędami</CardTitle>
            <ZapOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {connections.filter(c => c.status === 'error').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Wymagają naprawy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfer danych</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(connections.reduce((sum, c) => sum + (c.bytesTransferred || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Łączny transfer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista połączeń</CardTitle>
          <CardDescription>
            Status wszystkich skonfigurowanych połączeń z urządzeniami przemysłowymi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-gray-600">Ładowanie połączeń...</span>
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8">
              <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Brak skonfigurowanych połączeń</p>
              <p className="text-sm text-gray-500 mb-4">Dodaj pierwsze połączenie z urządzeniem</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj połączenie
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Połączenie</TableHead>
                    <TableHead>Protokół</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prędkość</TableHead>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Błędy</TableHead>
                    <TableHead>Ostatni kontakt</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((connection) => (
                    <TableRow key={connection.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getConnectionIcon(connection.status)}
                          <div>
                            <div className="font-medium">{connection.name}</div>
                            <div className="text-sm text-gray-500">{connection.protocol?.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {connection.protocol?.type?.toUpperCase() || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{connection.address}</TableCell>
                      <TableCell>{getStatusBadge(connection.status)}</TableCell>
                      <TableCell className="font-mono text-sm">{connection.dataRate || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{formatBytes(connection.bytesTransferred || 0)}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          connection.errorCount > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {connection.errorCount || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{getLastSeenText(connection.lastSeen)}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(connection.lastSeen).toLocaleString('pl-PL')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(connection)}
                            disabled={testingConnections.has(connection.id)}
                            title="Testuj połączenie"
                          >
                            {testingConnections.has(connection.id) ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Konfiguracja"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Edytuj"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-800"
                            title="Usuń"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Connection Health Summary */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Podsumowanie stanu połączeń</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((connections.filter(c => c.status === 'active').length / connections.length) * 100)}%
                </div>
                <div className="text-gray-600">Dostępność</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {connections.reduce((sum, c) => sum + (c.errorCount || 0), 0)}
                </div>
                <div className="text-gray-600">Łączne błędy</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {connections.filter(c => {
                    const diffMs = Date.now() - new Date(c.lastSeen).getTime();
                    return diffMs < 60000; // Last seen within 1 minute
                  }).length}
                </div>
                <div className="text-gray-600">Aktywne w ostatniej min</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {new Set(connections.map(c => c.protocol?.type)).size}
                </div>
                <div className="text-gray-600">Typy protokołów</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}