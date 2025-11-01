import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Activity,
  AlertCircle
} from 'lucide-react';
import { AddDeviceDialog } from './AddDeviceDialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface Device {
  id: string;
  name: string;
  description: string;
  device_type: 'infrastructure' | 'production';
  category: string;
  protocol_id: string;
  connection_id: string;
  address: string;
  port?: number;
  vendor: string;
  model: string;
  status: 'active' | 'inactive' | 'error';
  online: boolean;
  read_frequency: number;
  location_id: string;
  area_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Device['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Device['device_type']>('all');
  const { toast } = useToast();

  const loadDevices = useCallback(async () => {
    try {
      const response = await api.get('/api/devices');
      setDevices(response.data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się załadować urządzeń',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleDeleteDevice = useCallback(async (device: Device) => {
    if (!confirm(`Czy na pewno chcesz usunąć urządzenie "${device.name}"?`)) return;
    try {
      await api.delete(`/api/devices/${device.id}`);
      setDevices(prev => prev.filter(d => d.id !== device.id));
      toast({ title: 'Sukces', description: 'Urządzenie zostało usunięte' });
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć urządzenia',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const toggleDeviceStatus = useCallback(async (device: Device) => {
    const newStatus: Device['status'] = device.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/api/devices/${device.id}`, { status: newStatus });
      setDevices(prev =>
        prev.map(d => (d.id === device.id ? { ...d, status: newStatus } : d)),
      );
      toast({
        title: 'Sukces',
        description: `Urządzenie ${newStatus === 'active' ? 'aktywowane' : 'deaktywowane'}`,
      });
    } catch (error) {
      console.error('Error toggling device status:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zmienić statusu urządzenia',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleDeviceAdded = useCallback(() => {
    void loadDevices();     // odśwież listę
    setShowAddDialog(false);
    setEditingDevice(null);
  }, [loadDevices]);

  const getStatusBadge = useCallback((device: Device) => {
    if (device.status === 'active' && device.online) {
      return <Badge className="bg-green-100 text-green-800">Online</Badge>;
    }
    if (device.status === 'active' && !device.online) {
      return <Badge className="bg-yellow-100 text-yellow-800">Offline</Badge>;
    }
    if (device.status === 'error') {
      return <Badge className="bg-red-100 text-red-800">Błąd</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Nieaktywny</Badge>;
  }, []);

  const getDeviceTypeIcon = useCallback((device_type: Device['device_type']) => {
    return device_type === 'infrastructure' ? '🔌' : '🏭';
  }, []);

  const filteredDevices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return devices.filter(device => {
      const matchesSearch =
        !q ||
        device.name.toLowerCase().includes(q) ||
        (device.description?.toLowerCase() || '').includes(q) ||
        (device.vendor?.toLowerCase() || '').includes(q) ||
        (device.model?.toLowerCase() || '').includes(q);

      const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
      const matchesType = typeFilter === 'all' || device.device_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [devices, searchTerm, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zarządzanie urządzeniami</h1>
          <p className="text-gray-600">Zarządzaj urządzeniami przemysłowymi i ich konfiguracją</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadDevices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
          <Button
            onClick={() => {
              setEditingDevice(null);
              setShowAddDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj urządzenie
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filtry i wyszukiwanie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Wyszukaj urządzenia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="active">Aktywne</SelectItem>
                <SelectItem value="inactive">Nieaktywne</SelectItem>
                <SelectItem value="error">Błędy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Typ urządzenia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie typy</SelectItem>
                <SelectItem value="infrastructure">🔌 Infrastructure</SelectItem>
                <SelectItem value="production">🏭 Production</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-gray-600 self-center">
              {filteredDevices.length} z {devices.length} urządzeń
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Lista urządzeń
            </div>
            <Badge variant="secondary">{devices.length} total</Badge>
          </CardTitle>
          <CardDescription>Wszystkie skonfigurowane urządzenia w systemie</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-600">Ładowanie urządzeń...</div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-12">
              {devices.length === 0 ? (
                <>
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500 mb-4">Brak skonfigurowanych urządzeń</div>
                  <Button
                    onClick={() => {
                      setEditingDevice(null);
                      setShowAddDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj pierwsze urządzenie
                  </Button>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500 mb-4">Brak urządzeń pasujących do filtrów</div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}
                  >
                    Wyczyść filtry
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urządzenie</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Położenie</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Częstotliwość</TableHead>
                  <TableHead>Ostatnia aktualizacja</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map(device => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getDeviceTypeIcon(device.device_type)}</span>
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-sm text-gray-500">{device.description}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {device.device_type === 'infrastructure' ? 'Infrastructure' : 'Production'}
                      </Badge>
                      {device.category && (
                        <div className="text-xs text-gray-500 mt-1 capitalize">
                          {device.category.replace('_', ' ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {device.location_id && <div>📍 {device.location_id}</div>}
                        {device.area_id && <div className="text-gray-500">→ {device.area_id}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">
                        {device.address}
                        {device.port && <span>:{device.port}</span>}
                      </div>
                      {device.vendor && device.model && (
                        <div className="text-xs text-gray-500">
                          {device.vendor} {device.model}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(device)}</TableCell>
                    <TableCell>{device.read_frequency}ms</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(device.updated_at).toLocaleString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleDeviceStatus(device)}
                          title={device.status === 'active' ? 'Deaktywuj' : 'Aktywuj'}
                        >
                          {device.status === 'active' ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingDevice(device);
                            setShowAddDialog(true);
                          }}
                          title="Edytuj urządzenie"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteDevice(device)}
                          className="text-red-600 hover:text-red-800"
                          title="Usuń urządzenie"
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

      {/* Dialog dodawania/edycji */}
      <AddDeviceDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setEditingDevice(null);
        }}
        onSuccess={handleDeviceAdded}
        device={editingDevice ?? undefined} // jeśli AddDeviceDialog obsługuje edycję
      />
    </div>
  );
}
