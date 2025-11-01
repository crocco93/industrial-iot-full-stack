import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Play, Pause, Settings, RefreshCw, Trash2 } from 'lucide-react';
import { AddProtocolDialog } from './AddProtocolDialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface Protocol {
  id: string;
  name: string;
  type: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  version: string;
  configuration: Record<string, any>;
  devices: any[];
  createdAt: string;
  updatedAt: string;
}

export function ProtocolManager() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);  // ✅ DODANE
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = async () => {
    try {
      const response = await api.get('/api/protocols');
      setProtocols(response.data || []);
    } catch (error) {
      console.error('Error loading protocols:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować protokołów",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartProtocol = async (protocol: Protocol) => {
    try {
      await api.post(`/api/protocols/${protocol.id}/start`);
      await loadProtocols();
      toast({
        title: "Sukces",
        description: `Protokół ${protocol.name} został uruchomiony`,
      });
    } catch (error) {
      console.error('Error starting protocol:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się uruchomić protokołu",
        variant: "destructive",
      });
    }
  };

  const handleStopProtocol = async (protocol: Protocol) => {
    try {
      await api.post(`/api/protocols/${protocol.id}/stop`);
      await loadProtocols();
      toast({
        title: "Sukces",
        description: `Protokół ${protocol.name} został zatrzymany`,
      });
    } catch (error) {
      console.error('Error stopping protocol:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zatrzymać protokołu",
        variant: "destructive",
      });
    }
  };

  const handleRestartProtocol = async (protocol: Protocol) => {
    try {
      await api.post(`/api/protocols/${protocol.id}/restart`);
      await loadProtocols();
      toast({
        title: "Sukces",
        description: `Protokół ${protocol.name} został zrestartowany`,
      });
    } catch (error) {
      console.error('Error restarting protocol:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zrestartować protokołu",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProtocol = async (protocol: Protocol) => {
    if (!confirm(`Czy na pewno chcesz usunąć protokół "${protocol.name}"?`)) return;

    try {
      await api.delete(`/api/protocols/${protocol.id}`);
      await loadProtocols();
      toast({
        title: "Sukces",
        description: "Protokół został usunięty",
      });
    } catch (error) {
      console.error('Error deleting protocol:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć protokołu",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Połączony</Badge>;
      case 'disconnected':
        return <Badge className="bg-gray-100 text-gray-800">Rozłączony</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Błąd</Badge>;
      default:
        return <Badge>Nieznany</Badge>;
    }
  };

  const getProtocolDisplayName = (type: string) => {
    const protocolNames: Record<string, string> = {
      'modbus-tcp': 'Modbus TCP',
      'opc-ua': 'OPC-UA',
      'profinet': 'Profinet',
      'ethernet-ip': 'EtherNet/IP',
      'mqtt': 'MQTT',
      'canopen': 'CANopen',
      'bacnet': 'BACnet'
    };
    return protocolNames[type] || type;
  };

  // ✅ Handler dla sukcesu dodania protokołu
  const handleProtocolAdded = () => {
    loadProtocols(); // Reload the protocols list
    setShowAddDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zarządzanie protokołami</h1>
          <p className="text-gray-600">Zarządzaj protokołami komunikacyjnymi i ich konfiguracją</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadProtocols}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>  {/* ✅ ZMIENIONE */}
            <Plus className="h-4 w-4 mr-2" />
            Dodaj protokół
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista protokołów</CardTitle>
          <CardDescription>
            Wszystkie skonfigurowane protokoły komunikacyjne ({protocols.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-600">Ładowanie protokołów...</div>
            </div>
          ) : protocols.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">Brak skonfigurowanych protokołów</div>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pierwszy protokół
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Urządzenia</TableHead>
                  <TableHead>Wersja</TableHead>
                  <TableHead>Ostatnia aktualizacja</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocols.map((protocol) => (
                  <TableRow key={protocol.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{protocol.name}</div>
                        <div className="text-sm text-gray-500">{protocol.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getProtocolDisplayName(protocol.type)}</TableCell>
                    <TableCell>{getStatusBadge(protocol.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{protocol.devices?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>{protocol.version}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(protocol.updatedAt).toLocaleString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        {protocol.status === 'connected' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStopProtocol(protocol)}
                            title="Zatrzymaj protokół"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartProtocol(protocol)}
                            title="Uruchom protokół"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestartProtocol(protocol)}
                          title="Restartuj protokół"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingProtocol(protocol);
                            setShowAddDialog(true);
                          }}
                          title="Edytuj protokół"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteProtocol(protocol)}
                          className="text-red-600 hover:text-red-800"
                          title="Usuń protokół"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* ✅ DODANY Dialog */}
      <AddProtocolDialog 
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setEditingProtocol(null);
        }}
        onSuccess={handleProtocolAdded}
      />
    </div>
  );
}