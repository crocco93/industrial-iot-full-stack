import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface Protocol {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Connection {
  id: string;
  name: string;
  address: string;
  status: string;
  protocol_id: string;
}

interface DeviceFormData {
  name: string;
  description: string;
  device_type: 'infrastructure' | 'production';
  category: string;
  protocol_id: string;
  connection_id: string;
  location_id: string;
  area_id: string;
  address: string;
  port: number | '';
  vendor: string;
  model: string;
  serial_number: string;
  read_frequency: number;
  configuration: Record<string, any>;
}

interface AddDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEVICE_CATEGORIES = {
  infrastructure: [
    { value: 'power_meter', label: 'Power Meter', icon: '⚡' },
    { value: 'temperature_sensor', label: 'Temperature Sensor', icon: '🌡️' },
    { value: 'pressure_sensor', label: 'Pressure Sensor', icon: '📊' },
    { value: 'flow_sensor', label: 'Flow Sensor', icon: '💧' },
    { value: 'level_sensor', label: 'Level Sensor', icon: '📏' }
  ],
  production: [
    { value: 'plc_controller', label: 'PLC Controller', icon: '🎛️' },
    { value: 'motor_drive', label: 'Motor Drive', icon: '⚙️' },
    { value: 'robot_arm', label: 'Robot Arm', icon: '🤖' },
    { value: 'conveyor', label: 'Conveyor', icon: '📦' },
    { value: 'packaging_machine', label: 'Packaging Machine', icon: '📦' },
    { value: 'quality_scanner', label: 'Quality Scanner', icon: '🔍' }
  ]
};

export function AddDeviceDialog({ open, onClose, onSuccess }: AddDeviceDialogProps) {
  const [formData, setFormData] = useState<DeviceFormData>({
    name: '',
    description: '',
    device_type: 'production',
    category: '',
    protocol_id: '',
    connection_id: '',
    location_id: '',
    area_id: '',
    address: '',
    port: '',
    vendor: '',
    model: '',
    serial_number: '',
    read_frequency: 1000,
    configuration: {}
  });
  
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProtocolsAndConnections();
    }
  }, [open]);

  const loadProtocolsAndConnections = async () => {
    try {
      const [protocolsResponse, connectionsResponse] = await Promise.all([
        api.get('/api/protocols'),
        api.get('/api/connections')
      ]);
      
      setProtocols(protocolsResponse.data || []);
      setConnections(connectionsResponse.data || []);
    } catch (error) {
      console.error('Error loading protocols and connections:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.device_type) {
      toast({
        title: "Validation Error",
        description: "Name and device type are required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const deviceData = {
        ...formData,
        port: formData.port === '' ? null : formData.port,
        status: 'inactive',
        online: false,
        created_at: new Date().toISOString()
      };

      await api.post('/api/devices', deviceData);
      
      toast({
        title: "Device Added",
        description: `${formData.name} has been created successfully`
      });
      
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        device_type: 'production',
        category: '',
        protocol_id: '',
        connection_id: '',
        location_id: '',
        area_id: '',
        address: '',
        port: '',
        vendor: '',
        model: '',
        serial_number: '',
        read_frequency: 1000,
        configuration: {}
      });
      
    } catch (error: any) {
      console.error('Error creating device:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create device",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const availableConnections = connections.filter(conn => 
    !formData.protocol_id || conn.protocol_id === formData.protocol_id
  );

  const selectedProtocol = protocols.find(p => p.id === formData.protocol_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Configure a new industrial device or sensor
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Device Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Assembly Line PLC"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="device_type">Device Type *</Label>
                  <Select 
                    value={formData.device_type} 
                    onValueChange={(value: 'infrastructure' | 'production') => {
                      setFormData(prev => ({ 
                        ...prev, 
                        device_type: value,
                        category: '' // Reset category when type changes
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="infrastructure">
                        🔌 Infrastructure Device
                      </SelectItem>
                      <SelectItem value="production">
                        🏭 Production Device
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_CATEGORIES[formData.device_type].map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center space-x-2">
                          <span>{category.icon}</span>
                          <span>{category.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Device description and purpose..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Protocol & Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Protocol Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="protocol_id">Protocol</Label>
                  <Select value={formData.protocol_id} onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, protocol_id: value, connection_id: '' }));
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      {protocols.map(protocol => (
                        <SelectItem key={protocol.id} value={protocol.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{protocol.name}</span>
                            <Badge variant={protocol.status === 'connected' ? 'default' : 'secondary'} className="ml-2">
                              {protocol.type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="connection_id">Connection</Label>
                  <Select 
                    value={formData.connection_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, connection_id: value }))}
                    disabled={!formData.protocol_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.protocol_id ? "Select connection" : "Select protocol first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConnections.map(connection => (
                        <SelectItem key={connection.id} value={connection.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{connection.name || connection.address}</span>
                            <Badge variant={connection.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                              {connection.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedProtocol && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Badge>{selectedProtocol.type}</Badge>
                    <span className="text-sm text-blue-800">{selectedProtocol.name}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Device Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Device Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">Device Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="192.168.1.100 or device identifier"
                  />
                </div>
                
                <div>
                  <Label htmlFor="port">Port (optional)</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value ? parseInt(e.target.value) : '' }))}
                    placeholder="502, 4840, etc."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    value={formData.vendor}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="Siemens, ABB, Schneider..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="S7-1200, PowerLogic..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    placeholder="Device serial number"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="read_frequency">Read Frequency (ms)</Label>
                <Select 
                  value={formData.read_frequency.toString()} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, read_frequency: parseInt(value) }))}
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
                    <SelectItem value="60000">60000ms - Once per minute</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  How often to read data from this device
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Location Hierarchy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location Hierarchy</CardTitle>
              <CardDescription>
                Assign device to organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location_id">Location/Factory</Label>
                  <Input
                    id="location_id"
                    value={formData.location_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
                    placeholder="Main Factory, Building A..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="area_id">Area/Production Line</Label>
                  <Input
                    id="area_id"
                    value={formData.area_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, area_id: e.target.value }))}
                    placeholder="Assembly Line 1, Packaging..."
                  />
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <strong>Hierarchy Preview:</strong>
                <div className="mt-1 text-gray-600">
                  📍 {formData.location_id || 'Location'} 
                  {formData.area_id && ` → 🏭 ${formData.area_id}`}
                  {formData.name && ` → ${formData.device_type === 'infrastructure' ? '🔌' : '📱'} ${formData.name}`}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Device'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}