import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface ProtocolFormData {
  name: string;
  description: string;
  type: string;
  version: string;
  configuration: Record<string, any>;
}

interface AddProtocolDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PROTOCOL_TYPES = [
  { 
    value: 'modbus-tcp', 
    label: 'Modbus TCP', 
    description: 'Standard Modbus over TCP/IP',
    port: 502,
    fields: ['host', 'port', 'timeout', 'unit_id']
  },
  { 
    value: 'opc-ua', 
    label: 'OPC-UA', 
    description: 'OPC Unified Architecture',
    port: 4840,
    fields: ['endpoint_url', 'security_mode', 'security_policy', 'username', 'password']
  },
  { 
    value: 'mqtt', 
    label: 'MQTT', 
    description: 'Message Queuing Telemetry Transport',
    port: 1883,
    fields: ['broker_host', 'broker_port', 'username', 'password', 'client_id', 'qos']
  },
  { 
    value: 'ethernet-ip', 
    label: 'EtherNet/IP', 
    description: 'Allen-Bradley EtherNet/IP',
    port: 44818,
    fields: ['host', 'port', 'processor_slot', 'plc_type']
  },
  { 
    value: 'profinet', 
    label: 'Profinet', 
    description: 'Siemens Profinet',
    port: 102,
    fields: ['host', 'port', 'rack', 'slot', 'timeout']
  },
  { 
    value: 'canopen', 
    label: 'CANopen', 
    description: 'CAN bus with CANopen protocol',
    port: null,
    fields: ['can_interface', 'node_id', 'bitrate', 'timeout']
  },
  { 
    value: 'bacnet', 
    label: 'BACnet', 
    description: 'Building Automation and Control Networks',
    port: 47808,
    fields: ['device_id', 'max_apdu_length', 'segmentation']
  }
];

export function AddProtocolDialog({ open, onClose, onSuccess }: AddProtocolDialogProps) {
  const [formData, setFormData] = useState<ProtocolFormData>({
    name: '',
    description: '',
    type: '',
    version: '1.0',
    configuration: {}
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedProtocolType = PROTOCOL_TYPES.find(p => p.value === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      toast({
        title: "Validation Error",
        description: "Name and protocol type are required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const protocolData = {
        ...formData,
        status: 'disconnected',
        created_at: new Date().toISOString()
      };

      await api.post('/api/protocols', protocolData);
      
      toast({
        title: "Protocol Added",
        description: `${formData.name} protocol has been created successfully`
      });
      
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        type: '',
        version: '1.0',
        configuration: {}
      });
      
    } catch (error: any) {
      console.error('Error creating protocol:', error);
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create protocol",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfiguration = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));
  };

  const renderConfigurationFields = () => {
    if (!selectedProtocolType) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Protocol Configuration</h4>
        
        {selectedProtocolType.fields.map(field => {
          const isRequired = ['host', 'endpoint_url', 'broker_host', 'can_interface'].includes(field);
          const currentValue = formData.configuration[field] || '';
          
          if (field === 'security_mode' && formData.type === 'opc-ua') {
            return (
              <div key={field}>
                <Label htmlFor={field}>Security Mode {isRequired && '*'}</Label>
                <Select value={currentValue} onValueChange={(value) => updateConfiguration(field, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select security mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Sign">Sign</SelectItem>
                    <SelectItem value="SignAndEncrypt">Sign & Encrypt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }
          
          if (field === 'qos' && formData.type === 'mqtt') {
            return (
              <div key={field}>
                <Label htmlFor={field}>Quality of Service</Label>
                <Select value={currentValue} onValueChange={(value) => updateConfiguration(field, parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select QoS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - At most once</SelectItem>
                    <SelectItem value="1">1 - At least once</SelectItem>
                    <SelectItem value="2">2 - Exactly once</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }
          
          const inputType = field.includes('port') || field.includes('timeout') || field.includes('id') || field.includes('slot') || field.includes('rack')
            ? 'number'
            : field.includes('password')
            ? 'password'
            : 'text';
          
          const placeholder = field === 'host' ? '192.168.1.100'
            : field === 'port' ? selectedProtocolType.port?.toString() || ''
            : field === 'endpoint_url' ? 'opc.tcp://192.168.1.100:4840'
            : field === 'broker_host' ? '192.168.1.100'
            : field === 'can_interface' ? 'can0'
            : `Enter ${field.replace(/_/g, ' ')}`;
          
          return (
            <div key={field}>
              <Label htmlFor={field}>
                {field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field}
                type={inputType}
                value={currentValue}
                onChange={(e) => {
                  const value = inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
                  updateConfiguration(field, value);
                }}
                placeholder={placeholder}
                required={isRequired}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
    // zamykaj tylko gdy ktoś kliknie w tło / ESC
      if (!v) onClose();
    }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Protocol</DialogTitle>
          <DialogDescription>
            Configure a new industrial communication protocol
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Protocol Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Main PLC Modbus"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description of this protocol configuration..."
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="type">Protocol Type *</Label>
              <Select value={formData.type} onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  type: value,
                  configuration: {} // Reset configuration when type changes
                }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select protocol type" />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOL_TYPES.map(protocol => (
                    <SelectItem key={protocol.value} value={protocol.value}>
                      <div className="flex items-center space-x-2">
                        <span>{protocol.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {protocol.port ? `Port ${protocol.port}` : 'CAN Bus'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProtocolType && (
                <p className="text-xs text-gray-500 mt-1">{selectedProtocolType.description}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0"
              />
            </div>
          </div>
          
          {/* Protocol-specific Configuration */}
          {selectedProtocolType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedProtocolType.label} Configuration</CardTitle>
                <CardDescription>{selectedProtocolType.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderConfigurationFields()}
              </CardContent>
            </Card>
          )}
          
          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.type}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Protocol'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}