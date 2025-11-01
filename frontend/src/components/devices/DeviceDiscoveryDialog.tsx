import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Wifi,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  Network,
  Server,
  Activity,
  Clock,
  MapPin
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface DiscoveryPreset {
  name: string;
  network: string;
  description: string;
}

interface ProtocolPreset {
  name: string;
  protocols: string[];
  description: string;
}

interface DiscoveredDevice {
  host: string;
  port: number;
  protocol_type: string;
  device_info: {
    name: string;
    model: string;
    vendor: string;
    version: string;
    capabilities: string[];
  };
  discovered_at: string;
  selected?: boolean;
}

interface DeviceDiscoveryDialogProps {
  open: boolean;
  onClose: () => void;
  onDevicesAdded: (count: number) => void;
}

export function DeviceDiscoveryDialog({ open, onClose, onDevicesAdded }: DeviceDiscoveryDialogProps) {
  const [step, setStep] = useState<'configure' | 'scanning' | 'results'>('configure');
  const [networkRange, setNetworkRange] = useState('192.168.1.0/24');
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>(['modbus-tcp', 'opc-ua']);
  const [scanTimeout, setScanTimeout] = useState(5);
  
  const [networkPresets, setNetworkPresets] = useState<DiscoveryPreset[]>([]);
  const [protocolPresets, setProtocolPresets] = useState<ProtocolPreset[]>([]);
  
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [adding, setAdding] = useState(false);
  
  const { toast } = useToast();
  
  useEffect(() => {
    if (open) {
      loadDiscoveryPresets();
    }
  }, [open]);
  
  const loadDiscoveryPresets = async () => {
    try {
      const response = await api.get('/api/devices/discover/presets');
      const data = response.data;
      
      setNetworkPresets(data.network_presets || []);
      setProtocolPresets(data.protocol_combinations || []);
      
    } catch (error) {
      console.error('Failed to load discovery presets:', error);
    }
  };
  
  const startDiscovery = async () => {
    if (selectedProtocols.length === 0) {
      toast({
        title: "Protocol Selection Required",
        description: "Please select at least one protocol to scan for",
        variant: "destructive"
      });
      return;
    }
    
    setScanning(true);
    setStep('scanning');
    setScanProgress(0);
    
    try {
      // Progress simulation during scan
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 1000);
      
      const response = await api.post('/api/devices/discover', null, {
        params: {
          network: networkRange,
          protocols: selectedProtocols,
          timeout: scanTimeout
        }
      });
      
      clearInterval(progressInterval);
      setScanProgress(100);
      
      const devices = response.data.discovered_devices || [];
      setDiscoveredDevices(devices.map((device: DiscoveredDevice) => ({
        ...device,
        selected: true  // Select all by default
      })));
      
      setStep('results');
      
      toast({
        title: "Discovery Complete",
        description: `Found ${devices.length} devices on ${networkRange}`
      });
      
    } catch (error: any) {
      console.error('Discovery failed:', error);
      toast({
        title: "Discovery Failed",
        description: error.response?.data?.detail || "Network scan failed",
        variant: "destructive"
      });
      setStep('configure');
    } finally {
      setScanning(false);
    }
  };
  
  const addSelectedDevices = async () => {
    const selectedDevices = discoveredDevices.filter(d => d.selected);
    
    if (selectedDevices.length === 0) {
      toast({
        title: "No Devices Selected",
        description: "Please select at least one device to add",
        variant: "destructive"
      });
      return;
    }
    
    setAdding(true);
    let successCount = 0;
    
    try {
      for (const device of selectedDevices) {
        try {
          await api.post('/api/devices/discover/add-discovered', device);
          successCount++;
        } catch (error) {
          console.error(`Failed to add device ${device.host}:`, error);
        }
      }
      
      toast({
        title: "Devices Added",
        description: `Successfully added ${successCount} of ${selectedDevices.length} devices`
      });
      
      onDevicesAdded(successCount);
      onClose();
      
    } catch (error) {
      console.error('Failed to add devices:', error);
      toast({
        title: "Add Failed",
        description: "Failed to add selected devices",
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };
  
  const toggleDeviceSelection = (index: number) => {
    setDiscoveredDevices(prev => 
      prev.map((device, i) => 
        i === index ? { ...device, selected: !device.selected } : device
      )
    );
  };
  
  const selectAllDevices = (selected: boolean) => {
    setDiscoveredDevices(prev => 
      prev.map(device => ({ ...device, selected }))
    );
  };
  
  const resetDialog = () => {
    setStep('configure');
    setDiscoveredDevices([]);
    setScanProgress(0);
    setScanning(false);
  };
  
  const getProtocolIcon = (protocolType: string) => {
    switch (protocolType) {
      case 'modbus-tcp': return <Server className="h-4 w-4 text-blue-600" />;
      case 'opc-ua': return <Network className="h-4 w-4 text-green-600" />;
      case 'mqtt': return <Wifi className="h-4 w-4 text-purple-600" />;
      case 'ethernet-ip': return <Activity className="h-4 w-4 text-orange-600" />;
      default: return <MapPin className="h-4 w-4 text-gray-600" />;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open && !scanning) {
        onClose();
        resetDialog();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Device Discovery</DialogTitle>
          <DialogDescription>
            Automatically discover devices on your network that support industrial protocols
          </DialogDescription>
        </DialogHeader>
        
        {/* Configuration Step */}
        {step === 'configure' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Network Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Network Range</CardTitle>
                  <CardDescription>Specify the network range to scan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="network">Network (CIDR Notation) *</Label>
                    <Input
                      id="network"
                      value={networkRange}
                      onChange={(e) => setNetworkRange(e.target.value)}
                      placeholder="192.168.1.0/24"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Example: 192.168.1.0/24 scans 192.168.1.1 to 192.168.1.254
                    </p>
                  </div>
                  
                  <div>
                    <Label>Network Presets</Label>
                    <div className="space-y-2 mt-2">
                      {networkPresets.map((preset, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto p-3 text-left"
                          onClick={() => setNetworkRange(preset.network)}
                        >
                          <div>
                            <div className="font-medium text-sm">{preset.name}</div>
                            <div className="text-xs text-gray-500">{preset.network}</div>
                            <div className="text-xs text-gray-400">{preset.description}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="timeout">Scan Timeout (seconds)</Label>
                    <Select value={scanTimeout.toString()} onValueChange={(value) => setScanTimeout(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2s - Fast</SelectItem>
                        <SelectItem value="5">5s - Normal</SelectItem>
                        <SelectItem value="10">10s - Thorough</SelectItem>
                        <SelectItem value="20">20s - Very Thorough</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              
              {/* Protocol Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Protocols to Scan</CardTitle>
                  <CardDescription>Select which industrial protocols to detect</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { value: 'modbus-tcp', label: 'Modbus TCP', port: 502, desc: 'Most common industrial protocol' },
                      { value: 'opc-ua', label: 'OPC-UA', port: 4840, desc: 'Modern industrial standard' },
                      { value: 'mqtt', label: 'MQTT', port: 1883, desc: 'IoT messaging protocol' },
                      { value: 'ethernet-ip', label: 'EtherNet/IP', port: 44818, desc: 'Allen-Bradley protocol' },
                      { value: 'profinet', label: 'Profinet', port: 102, desc: 'Siemens protocol' },
                      { value: 'bacnet', label: 'BACnet', port: 47808, desc: 'Building automation' }
                    ].map((protocol) => (
                      <div key={protocol.value} className="flex items-center space-x-3 p-2 border rounded">
                        <Checkbox
                          checked={selectedProtocols.includes(protocol.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProtocols(prev => [...prev, protocol.value]);
                            } else {
                              setSelectedProtocols(prev => prev.filter(p => p !== protocol.value));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getProtocolIcon(protocol.value)}
                            <span className="font-medium text-sm">{protocol.label}</span>
                            <Badge variant="outline" className="text-xs">Port {protocol.port}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">{protocol.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label>Protocol Presets</Label>
                    <div className="space-y-2 mt-2">
                      {protocolPresets.map((preset, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto p-2 text-left w-full"
                          onClick={() => setSelectedProtocols(preset.protocols)}
                        >
                          <div>
                            <div className="font-medium text-sm">{preset.name}</div>
                            <div className="text-xs text-gray-500">{preset.description}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={startDiscovery} disabled={!networkRange || selectedProtocols.length === 0}>
                <Search className="h-4 w-4 mr-2" />
                Start Discovery
              </Button>
            </div>
          </div>
        )}
        
        {/* Scanning Step */}
        {step === 'scanning' && (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <RefreshCw className="h-12 w-12 text-blue-600 animate-spin" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Scanning Network</h3>
                <p className="text-gray-600">Discovering devices on {networkRange}...</p>
              </div>
              
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={scanProgress} className="h-3" />
                <p className="text-sm text-gray-500">{scanProgress}% complete</p>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Scanning protocols: {selectedProtocols.join(', ')}</p>
                <p>Timeout: {scanTimeout} seconds per host</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-start space-x-2">
                <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Please wait...</strong> Network discovery can take several minutes depending on the network size and number of protocols.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Results Step */}
        {step === 'results' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Discovery Results</h3>
                <p className="text-gray-600">
                  Found {discoveredDevices.length} devices on {networkRange}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectAllDevices(true)}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectAllDevices(false)}
                >
                  Select None
                </Button>
              </div>
            </div>
            
            {discoveredDevices.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Devices Found</h3>
                  <p className="text-gray-600 mb-4">
                    No devices were found on {networkRange} for the selected protocols
                  </p>
                  <div className="space-y-2 text-sm text-gray-600 mb-6">
                    <p>• Check that devices are powered on and connected</p>
                    <p>• Verify network connectivity and firewall settings</p>
                    <p>• Try a different network range or protocols</p>
                  </div>
                  <Button onClick={() => setStep('configure')}>
                    Try Different Settings
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-auto">
                  {discoveredDevices.map((device, index) => (
                    <Card key={index} className={`cursor-pointer transition-colors ${
                      device.selected ? 'border-blue-200 bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={device.selected || false}
                            onCheckedChange={() => toggleDeviceSelection(index)}
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getProtocolIcon(device.protocol_type)}
                              <span className="font-semibold">{device.device_info.name}</span>
                              <Badge className="text-xs">{device.protocol_type.toUpperCase()}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Address:</span>
                                <span className="ml-2 font-medium">{device.host}:{device.port}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Model:</span>
                                <span className="ml-2">{device.device_info.model}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Vendor:</span>
                                <span className="ml-2">{device.device_info.vendor}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Version:</span>
                                <span className="ml-2">{device.device_info.version}</span>
                              </div>
                            </div>
                            
                            {device.device_info.capabilities.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">Capabilities:</div>
                                <div className="flex flex-wrap gap-1">
                                  {device.device_info.capabilities.map((cap, i) => (
                                    <Badge key={i} variant="outline" className="text-xs px-2 py-0">
                                      {cap}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    {discoveredDevices.filter(d => d.selected).length} of {discoveredDevices.length} selected
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => setStep('configure')}>
                      Back to Configuration
                    </Button>
                    <Button 
                      onClick={addSelectedDevices} 
                      disabled={discoveredDevices.filter(d => d.selected).length === 0 || adding}
                    >
                      {adding ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Selected Devices
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}