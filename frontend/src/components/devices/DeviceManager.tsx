import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Plus, Edit, Trash2, Power, PowerOff, Settings } from 'lucide-react';
import { DeviceForm } from '../forms/DeviceForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../ui/use-toast';
import { api } from '../services/api';

interface Device {
  id: string;
  name: string;
  description: string;
  protocolId: string;
  address: string;
  status: 'active' | 'inactive' | 'error';
  readFrequency: number;
  createdAt: string;
  updatedAt: string;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const response = await api.get('/api/devices');
      setDevices(response.data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować urządzeń",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async (deviceData: Partial<Device>) => {
    try {
      const response = await api.post('/api/devices', deviceData);
      setDevices([...devices, response.data]);
      setShowForm(false);
      toast({
        title: "Sukces",
        description: "Urządzenie zostało utworzone",
      });
    } catch (error) {
      console.error('Error creating device:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się utworzyć urządzenia",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDevice = async (deviceData: Partial<Device>) => {
    if (!editingDevice) return;
    
    try {
      const response = await api.put(`/api/devices/${editingDevice.id}`, deviceData);
      setDevices(devices.map(d => d.id === editingDevice.id ? response.data : d));
      setEditingDevice(null);
      setShowForm(false);
      toast({
        title: "Sukces",
        description: "Urządzenie zostało zaktualizowane",
      });
    } catch (error) {
      console.error('Error updating device:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować urządzenia",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!confirm(`Czy na pewno chcesz usunąć urządzenie "${device.name}"?`)) return;

    try {
      await api.delete(`/api/devices/${device.id}`);
      setDevices(devices.filter(d => d.id !== device.id));
      toast({
        title: "Sukces",
        description: "Urządzenie zostało usunięte",
      });
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć urządzenia",
        variant: "destructive",
      });
    }
  };

  const toggleDeviceStatus = async (device: Device) => {
    const newStatus = device.status === 'active' ? 'inactive' : 'active';
    try {
      await handleUpdateDevice({ status: newStatus });
    } catch (error) {
      console.error('Error toggling device status:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Zarządzanie urządzeniami</h1>
          <p className="text-gray-600">Zarządzaj urządzeniami przemysłowymi i ich konfiguracją</p>
        </div>
        <Button onClick={() => {
          setEditingDevice(null);
          setShowForm(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj urządzenie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista urządzeń</CardTitle>
          <CardDescription>
            Wszystkie skonfigurowane urządzenia w systemie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-600">Ładowanie urządzeń...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Częstotliwość odczytu</TableHead>
                  <TableHead>Ostatnia aktualizacja</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{device.name}</div>
                        <div className="text-sm text-gray-500">{device.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>{device.address}</TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell>{device.readFrequency}ms</TableCell>
                    <TableCell>
                      {new Date(device.updatedAt).toLocaleString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleDeviceStatus(device)}
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
                            setShowForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteDevice(device)}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? 'Edytuj urządzenie' : 'Dodaj nowe urządzenie'}
            </DialogTitle>
          </DialogHeader>
          <DeviceForm
            initialData={editingDevice}
            onSubmit={editingDevice ? handleUpdateDevice : handleCreateDevice}
            onCancel={() => {
              setShowForm(false);
              setEditingDevice(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
