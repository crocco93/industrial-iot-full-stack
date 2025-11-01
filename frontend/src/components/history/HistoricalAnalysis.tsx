import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, BarChart3, Activity, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface DataPoint {
  id: string;
  name: string;
  device_id: string;
  device_name: string;
  address: string;
  data_type: string;
  unit: string;
  min_value?: number;
  max_value?: number;
  protocol_type: string;
}

interface HistoricalDataPoint {
  timestamp: string;
  value: number;
  data_point_id: string;
  quality: number;
}

interface ChartData {
  timestamp: string;
  [key: string]: any; // Dynamic keys for multiple data points
}

const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1'  // indigo
];

// Sample mock data for development
const MOCK_DATA_POINTS: DataPoint[] = [
  {
    id: 'dp_001',
    name: 'Temperature Zone A',
    device_id: 'dev_001',
    device_name: 'Temperature Sensor A1',
    address: '40001',
    data_type: 'float',
    unit: '°C',
    min_value: 0,
    max_value: 100,
    protocol_type: 'modbus-tcp'
  },
  {
    id: 'dp_002',
    name: 'Pressure Main Line',
    device_id: 'dev_002',
    device_name: 'Pressure Sensor P1',
    address: '40002',
    data_type: 'float',
    unit: 'bar',
    min_value: 0,
    max_value: 10,
    protocol_type: 'modbus-tcp'
  },
  {
    id: 'dp_003',
    name: 'Flow Rate',
    device_id: 'dev_003',
    device_name: 'Flow Meter F1',
    address: '40003',
    data_type: 'float',
    unit: 'L/min',
    min_value: 0,
    max_value: 500,
    protocol_type: 'modbus-tcp'
  },
  {
    id: 'dp_004',
    name: 'Motor RPM',
    device_id: 'dev_004',
    device_name: 'Motor Controller M1',
    address: 'ns=2;i=1001',
    data_type: 'int',
    unit: 'RPM',
    min_value: 0,
    max_value: 3600,
    protocol_type: 'opc-ua'
  },
  {
    id: 'dp_005',
    name: 'Power Consumption',
    device_id: 'dev_005',
    device_name: 'Power Meter PM1',
    address: 'power/consumption',
    data_type: 'float',
    unit: 'kW',
    min_value: 0,
    max_value: 50,
    protocol_type: 'mqtt'
  }
];

function generateMockHistoricalData(dataPointIds: string[], startDate: Date, endDate: Date, aggregation: string): ChartData[] {
  const data: ChartData[] = [];
  const msPerPoint = aggregation === 'raw' ? 60000 : aggregation === 'hourly' ? 3600000 : 86400000; // 1min, 1h, 1day
  
  for (let time = startDate.getTime(); time <= endDate.getTime(); time += msPerPoint) {
    const timestamp = new Date(time).toISOString();
    const dataPoint: ChartData = { timestamp };
    
    dataPointIds.forEach((dpId, index) => {
      const dp = MOCK_DATA_POINTS.find(d => d.id === dpId);
      if (dp) {
        // Generate realistic mock values based on data point type
        let baseValue = 50;
        if (dp.name.includes('Temperature')) baseValue = 25 + Math.sin(time / 3600000) * 15;
        else if (dp.name.includes('Pressure')) baseValue = 5 + Math.sin(time / 1800000) * 2;
        else if (dp.name.includes('Flow')) baseValue = 200 + Math.sin(time / 7200000) * 100;
        else if (dp.name.includes('RPM')) baseValue = 1800 + Math.sin(time / 3600000) * 600;
        else if (dp.name.includes('Power')) baseValue = 25 + Math.sin(time / 3600000) * 10;
        
        // Add some random noise
        const noise = (Math.random() - 0.5) * (baseValue * 0.1);
        dataPoint[dp.name] = Math.max(0, baseValue + noise);
      }
    });
    
    data.push(dataPoint);
  }
  
  return data;
}

export function HistoricalAnalysis() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(MOCK_DATA_POINTS);
  const [selectedDataPoints, setSelectedDataPoints] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<ChartData[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days ago
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0] // today
  );
  const [aggregation, setAggregation] = useState<'raw' | 'hourly' | 'daily'>('hourly');
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadDevicesAndDataPoints();
  }, []);

  useEffect(() => {
    if (selectedDataPoints.length > 0 && startDate && endDate) {
      loadHistoricalData();
    } else {
      setHistoricalData([]);
    }
  }, [selectedDataPoints, startDate, endDate, aggregation]);

  const loadDevicesAndDataPoints = async () => {
    try {
      // Try to load real data first
      const [devicesResponse, dataPointsResponse] = await Promise.all([
        api.get('/api/devices').catch(() => ({ data: [] })),
        api.get('/api/data-points').catch(() => ({ data: [] }))
      ]);
      
      let devicesData = devicesResponse.data || [];
      let dataPointsData = dataPointsResponse.data || [];
      
      // If no real data, use mock devices
      if (devicesData.length === 0) {
        devicesData = [
          { id: 'dev_001', name: 'Temperature Sensor A1', device_type: 'sensor', protocol: { type: 'modbus-tcp' } },
          { id: 'dev_002', name: 'Pressure Sensor P1', device_type: 'sensor', protocol: { type: 'modbus-tcp' } },
          { id: 'dev_003', name: 'Flow Meter F1', device_type: 'meter', protocol: { type: 'modbus-tcp' } },
          { id: 'dev_004', name: 'Motor Controller M1', device_type: 'controller', protocol: { type: 'opc-ua' } },
          { id: 'dev_005', name: 'Power Meter PM1', device_type: 'meter', protocol: { type: 'mqtt' } }
        ];
      }
      
      // If no real data points, use mock data
      if (dataPointsData.length === 0) {
        dataPointsData = MOCK_DATA_POINTS;
      }
      
      setDevices(devicesData);
      
      // Enrich data points with device info
      const enrichedDataPoints = dataPointsData.map((dp: any) => {
        const device = devicesData.find((d: any) => d.id === dp.device_id);
        return {
          ...dp,
          device_name: device?.name || 'Unknown Device',
          protocol_type: device?.protocol?.type || 'Unknown'
        };
      });
      
      setDataPoints(enrichedDataPoints);
      
      toast({
        title: "Dane załadowane",
        description: `Załadowano ${enrichedDataPoints.length} punktów danych z ${devicesData.length} urządzeń`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error loading data:', error);
      // Use mock data as fallback
      setDataPoints(MOCK_DATA_POINTS);
      setDevices([
        { id: 'dev_001', name: 'Temperature Sensor A1', device_type: 'sensor' },
        { id: 'dev_002', name: 'Pressure Sensor P1', device_type: 'sensor' },
        { id: 'dev_003', name: 'Flow Meter F1', device_type: 'meter' }
      ]);
      
      toast({
        title: "Używam danych przykładowych",
        description: "API niedostępne - używam danych demonstracyjnych",
        variant: "default"
      });
    }
  };

  const loadHistoricalData = async () => {
    if (!startDate || !endDate || selectedDataPoints.length === 0) return;
    
    setLoading(true);
    try {
      // Try to load real historical data
      const response = await api.get('/api/data-points/historical', {
        params: {
          data_point_ids: selectedDataPoints.join(','),
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate + 'T23:59:59').toISOString(),
          aggregation,
          limit: 1000
        }
      }).catch(() => ({ data: [] }));
      
      if (response.data && response.data.length > 0) {
        setHistoricalData(response.data);
      } else {
        // Generate mock data
        const mockData = generateMockHistoricalData(
          selectedDataPoints,
          new Date(startDate),
          new Date(endDate + 'T23:59:59'),
          aggregation
        );
        setHistoricalData(mockData);
        
        toast({
          title: "Dane przykładowe",
          description: "Wygenerowano przykładowe dane historyczne",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować danych historycznych",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataPointToggle = (dataPointId: string, checked: boolean) => {
    if (checked) {
      if (selectedDataPoints.length >= 10) {
        toast({
          title: "Osiągnięto limit",
          description: "Maksymalnie 10 punktów danych może być wybranych",
          variant: "destructive"
        });
        return;
      }
      setSelectedDataPoints(prev => [...prev, dataPointId]);
    } else {
      setSelectedDataPoints(prev => prev.filter(id => id !== dataPointId));
    }
  };

  const exportData = async () => {
    if (historicalData.length === 0) {
      toast({
        title: "Brak danych",
        description: "Brak danych do eksportu"
      });
      return;
    }
    
    try {
      const csvContent = convertToCSV(historicalData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historical_analysis_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Eksport udany",
        description: "Dane zostały wyeksportowane do pliku CSV"
      });
    } catch (error) {
      toast({
        title: "Eksport nieudany",
        description: "Nie udało się wyeksportować danych",
        variant: "destructive"
      });
    }
  };

  const convertToCSV = (data: ChartData[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  };

  const filteredDataPoints = selectedDevice === 'all' 
    ? dataPoints 
    : dataPoints.filter(dp => dp.device_id === selectedDevice);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return aggregation === 'daily' 
      ? date.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })
      : date.toLocaleString('pl-PL', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Analiza danych historycznych</h1>
          <p className="text-gray-600">Analizuj trendy i wzorce w danych przemysłowych</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={loadHistoricalData} 
            disabled={loading || selectedDataPoints.length === 0}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież dane
          </Button>
          <Button onClick={exportData} disabled={historicalData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Eksport CSV
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Konfiguracja analizy
          </CardTitle>
          <CardDescription>
            Wybierz punkty danych i zakres czasowy dla analizy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Device Filter */}
            <div>
              <Label>Filtr urządzeń</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie urządzenia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie urządzenia</SelectItem>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.device_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Aggregation */}
            <div>
              <Label>Agregacja danych</Label>
              <Select value={aggregation} onValueChange={(value: 'raw' | 'hourly' | 'daily') => setAggregation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Dane surowe</SelectItem>
                  <SelectItem value="hourly">Średnia godzinowa</SelectItem>
                  <SelectItem value="daily">Średnia dzienna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Start Date */}
            <div>
              <Label>Data początkowa</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            
            {/* End Date */}
            <div>
              <Label>Data końcowa</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Point Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Wybierz punkty danych</CardTitle>
          <CardDescription>
            Wybierz maksymalnie 10 punktów danych do porównania na wykresie
            {selectedDataPoints.length > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                ({selectedDataPoints.length}/10 wybranych)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDataPoints.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Brak dostępnych punktów danych dla wybranego urządzenia</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2">
              {filteredDataPoints.map((dataPoint, index) => {
                const isSelected = selectedDataPoints.includes(dataPoint.id);
                const colorIndex = selectedDataPoints.indexOf(dataPoint.id);
                
                return (
                  <div 
                    key={dataPoint.id} 
                    className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                      isSelected ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <Checkbox
                      id={dataPoint.id}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleDataPointToggle(dataPoint.id, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={dataPoint.id} className="font-medium cursor-pointer text-sm">
                          {dataPoint.name}
                        </Label>
                        {isSelected && colorIndex >= 0 && (
                          <div 
                            className="w-3 h-3 rounded-full border border-white"
                            style={{ backgroundColor: CHART_COLORS[colorIndex % CHART_COLORS.length] }}
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {dataPoint.device_name} • {dataPoint.unit || 'brak jednostki'}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {dataPoint.protocol_type}
                        </Badge>
                        <span>{dataPoint.address}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Chart */}
      {selectedDataPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Trendy danych historycznych
              </div>
              <Badge variant="secondary">
                {historicalData.length} punktów danych
              </Badge>
            </CardTitle>
            <CardDescription>
              {startDate && endDate && (
                <span>
                  Od {new Date(startDate).toLocaleDateString('pl-PL')} do {new Date(endDate).toLocaleDateString('pl-PL')} 
                  • agregacja {aggregation === 'raw' ? 'surowa' : aggregation === 'hourly' ? 'godzinowa' : 'dzienna'}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mr-3" />
                <div className="text-gray-600">Ładowanie danych historycznych...</div>
              </div>
            ) : historicalData.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Brak danych historycznych dla wybranego okresu</p>
                <p className="text-sm text-gray-500 mt-2">
                  Spróbuj wybrać inny zakres dat lub punkty danych
                </p>
              </div>
            ) : (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTimestamp}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={11}
                      interval="preserveStartEnd"
                    />
                    <YAxis fontSize={11} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString('pl-PL')}
                      formatter={(value: any, name: string) => {
                        const dataPoint = dataPoints.find(dp => dp.name === name);
                        return [
                          `${typeof value === 'number' ? value.toFixed(2) : value}`,
                          `${name} ${dataPoint?.unit ? `(${dataPoint.unit})` : ''}`
                        ];
                      }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value: string) => {
                        const dataPoint = dataPoints.find(dp => dp.name === value);
                        return (
                          <span className="text-sm">
                            {value} {dataPoint?.unit && `(${dataPoint.unit})`}
                          </span>
                        );
                      }}
                    />
                    
                    {selectedDataPoints.map((dpId, index) => {
                      const dataPoint = dataPoints.find(dp => dp.id === dpId);
                      const color = CHART_COLORS[index % CHART_COLORS.length];
                      
                      return (
                        <Line
                          key={dpId}
                          type="monotone"
                          dataKey={dataPoint?.name || `DataPoint_${index}`}
                          stroke={color}
                          strokeWidth={2}
                          dot={{ fill: color, strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                          connectNulls={false}
                          name={dataPoint?.name || `DataPoint ${index + 1}`}
                        />
                      );
                    })}
                    
                    {/* Reference lines for thresholds */}
                    {selectedDataPoints.map((dpId) => {
                      const dataPoint = dataPoints.find(dp => dp.id === dpId);
                      if (!dataPoint?.max_value) return null;
                      
                      return (
                        <ReferenceLine 
                          key={`max-${dpId}`}
                          y={dataPoint.max_value} 
                          stroke="#ef4444" 
                          strokeDasharray="8 4"
                          strokeWidth={1}
                          label={{ 
                            value: `Max: ${dataPoint.max_value}${dataPoint.unit ? dataPoint.unit : ''}`, 
                            position: "topRight",
                            style: { fontSize: '11px', fill: '#ef4444' }
                          }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Summary */}
      {historicalData.length > 0 && selectedDataPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Podsumowanie analizy</CardTitle>
            <CardDescription>
              Statystyki dla wybranych punktów danych w okresie {startDate} - {endDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {selectedDataPoints.map((dpId, index) => {
                const dataPoint = dataPoints.find(dp => dp.id === dpId);
                const values = historicalData
                  .map(d => d[dataPoint?.name || ''])
                  .filter(v => v != null && typeof v === 'number');
                
                if (values.length === 0) return null;
                
                const min = Math.min(...values);
                const max = Math.max(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const color = CHART_COLORS[index % CHART_COLORS.length];
                
                // Calculate trend
                const firstHalf = values.slice(0, Math.floor(values.length / 2));
                const secondHalf = values.slice(Math.floor(values.length / 2));
                const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
                const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
                const trend = secondAvg > firstAvg ? 'rosnący' : secondAvg < firstAvg ? 'malejący' : 'stabilny';
                
                return (
                  <div key={dpId} className="p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: color }} />
                      <h4 className="font-medium text-sm truncate">{dataPoint?.name}</h4>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Min:</span>
                        <span className="font-mono">{min.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max:</span>
                        <span className="font-mono">{max.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Średnia:</span>
                        <span className="font-mono">{avg.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Punktów:</span>
                        <span className="font-medium">{values.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Trend:</span>
                        <span className={`font-medium ${
                          trend === 'rosnący' ? 'text-green-600' : 
                          trend === 'malejący' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {trend}
                        </span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rozstęp:</span>
                          <span className="font-mono">{(max - min).toFixed(2)} {dataPoint?.unit}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Quick Actions */}
      {selectedDataPoints.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Szybkie akcje</CardTitle>
            <CardDescription>Wybierz gotowy zestaw punktów danych do analizy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => setSelectedDataPoints(['dp_001', 'dp_002'])}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">Kontrola klimatu</div>
                <div className="text-sm text-gray-500 mt-1">Temperatura i ciśnienie</div>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedDataPoints(['dp_003', 'dp_004'])}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">Wydajność produkcji</div>
                <div className="text-sm text-gray-500 mt-1">Przepływ i prędkość obrotowa</div>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedDataPoints(['dp_005'])}
                className="h-auto p-4 flex flex-col items-start"
              >
                <div className="font-medium">Zużycie energii</div>
                <div className="text-sm text-gray-500 mt-1">Moc elektryczna</div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}