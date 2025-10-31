import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Zap, ZapOff, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/services/api/ApiClient';

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
    name: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function ConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadConnections();
    const interval = setInterval(loadConnections, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadConnections = async () => {
    try {
      const response = await api.get('/api/connections');
      setConnections(response.data || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować połączeń",
        variant: "destructive",
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
        title: response.data.success ? "Sukces" : "Błąd",
        description: response.data.message,
        variant: response.data.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się przetestować połączenia",
        variant: "destructive",
      });
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
        return <Badge>Nieznany</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zarządzanie połączeniami</h1>
          <p className="text-gray-600">Monitoruj i zarządzaj połączeniami z urządzeniami przemysłowymi</p>
        </div>
        <Button onClick={loadConnections}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Odśwież
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie połączenia</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Całkowity transfer</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(connections.reduce((sum, c) => sum + (c.bytesTransferred || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista połączeń</CardTitle>
          <CardDescription>
            Status wszystkich aktywnych połączeń z urządzeniami
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-600">Ładowanie połączeń...</div>
            </div>
          ) : (
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
                  <TableRow key={connection.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getConnectionIcon(connection.status)}
                        <div>
                          <div className="font-medium">{connection.name}</div>
                          <div className="text-sm text-gray-500">{connection.protocol?.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{connection.protocol?.type || 'N/A'}</TableCell>
                    <TableCell>{connection.address}</TableCell>
                    <TableCell>{getStatusBadge(connection.status)}</TableCell>
                    <TableCell>{connection.dataRate || 'N/A'}</TableCell>
                    <TableCell>{formatBytes(connection.bytesTransferred || 0)}</TableCell>
                    <TableCell>
                      <span className={connection.errorCount > 0 ? 'text-red-600' : 'text-gray-600'}>
                        {connection.errorCount || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(connection.lastSeen).toLocaleString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(connection)}
                        disabled={testingConnections.has(connection.id)}
                      >
                        {testingConnections.has(connection.id) ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
