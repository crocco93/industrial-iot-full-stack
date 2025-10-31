import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Calendar, TrendingUp, Download, Filter, BarChart3, Activity, Zap } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';

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

export function HistoricalAnalysis() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [selectedDataPoints, setSelectedDataPoints] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<ChartData[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date()
  });
  const [aggregation, setAggregation] = useState<'raw' | 'hourly' | 'daily'>('hourly');
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadDevicesAndDataPoints();
  }, []);

  useEffect(() => {
    if (selectedDataPoints.length > 0 && dateRange?.from && dateRange?.to) {
      loadHistoricalData();
    }
  }, [selectedDataPoints, dateRange, aggregation]);

  const loadDevicesAndDataPoints = async () => {
    try {
      const [devicesResponse, dataPointsResponse] = await Promise.all([
        api.get('/api/devices'),
        api.get('/api/data-points')
      ]);
      
      const devicesData = devicesResponse.data || [];
      const dataPointsData = dataPointsResponse.data || [];
      
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
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load devices and data points",
        variant: "destructive"
      });
    }
  };

  const loadHistoricalData = async () => {
    if (!dateRange?.from || !dateRange?.to || selectedDataPoints.length === 0) return;
    
    setLoading(true);
    try {
      const queries = selectedDataPoints.map(dpId => 
        api.get('/api/data-points/historical', {
          params: {
            data_point_id: dpId,
            start_date: dateRange.from!.toISOString(),
            end_date: dateRange.to!.toISOString(),
            aggregation,
            limit: 1000
          }
        })
      );
      
      const responses = await Promise.all(queries);
      
      // Merge data from multiple data points
      const timeSeriesMap = new Map<string, ChartData>();
      
      responses.forEach((response, index) => {
        const dpId = selectedDataPoints[index];
        const dataPoint = dataPoints.find(dp => dp.id === dpId);
        const data = response.data || [];
        
        data.forEach((point: HistoricalDataPoint) => {
          const timestamp = point.timestamp;
          if (!timeSeriesMap.has(timestamp)) {
            timeSeriesMap.set(timestamp, { timestamp });
          }
          
          const entry = timeSeriesMap.get(timestamp)!;
          entry[dataPoint?.name || `DataPoint_${index}`] = point.value;
          entry[`${dataPoint?.name || `DataPoint_${index}`}_quality`] = point.quality;
        });
      });
      
      // Convert to array and sort by timestamp
      const chartData = Array.from(timeSeriesMap.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setHistoricalData(chartData);
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load historical data",
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
          title: "Limit reached",
          description: "Maximum 10 data points can be selected",
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
        title: "No data",
        description: "No data available for export"
      });
      return;
    }
    
    try {
      const csvContent = convertToCSV(historicalData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historical_analysis_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Data exported to CSV file"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export data",
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
    return format(new Date(timestamp), aggregation === 'daily' ? 'MMM dd' : 'MMM dd HH:mm');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Historical Data Analysis</h1>
          <p className="text-gray-600">Analyze trends and patterns in your industrial data</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={exportData} disabled={historicalData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Analysis Configuration
          </CardTitle>
          <CardDescription>
            Select data points and time range for analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Device Filter */}
            <div>
              <Label>Device Filter</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
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
              <Label>Data Aggregation</Label>
              <Select value={aggregation} onValueChange={(value: 'raw' | 'hourly' | 'daily') => setAggregation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw Data</SelectItem>
                  <SelectItem value="hourly">Hourly Average</SelectItem>
                  <SelectItem value="daily">Daily Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <DatePickerWithRange 
                date={dateRange} 
                onDateChange={setDateRange}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Point Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Data Points</CardTitle>
          <CardDescription>
            Choose up to 10 data points to compare on the chart
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDataPoints.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No data points available for selected device</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-auto">
              {filteredDataPoints.map((dataPoint, index) => {
                const isSelected = selectedDataPoints.includes(dataPoint.id);
                const colorIndex = selectedDataPoints.indexOf(dataPoint.id);
                
                return (
                  <div key={dataPoint.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={dataPoint.id}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleDataPointToggle(dataPoint.id, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={dataPoint.id} className="font-medium cursor-pointer">
                          {dataPoint.name}
                        </Label>
                        {isSelected && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[colorIndex % CHART_COLORS.length] }}
                          />
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {dataPoint.device_name} • {dataPoint.unit}
                      </div>
                      <div className="text-xs text-gray-400">
                        {dataPoint.protocol_type} • {dataPoint.address}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {selectedDataPoints.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {selectedDataPoints.length} data point{selectedDataPoints.length > 1 ? 's' : ''} selected
                </span>
              </div>
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
                Historical Data Trends
              </div>
              <Badge variant="secondary">
                {historicalData.length} data points
              </Badge>
            </CardTitle>
            <CardDescription>
              {dateRange?.from && dateRange?.to && (
                <span>
                  From {format(dateRange.from, 'MMM dd, yyyy')} to {format(dateRange.to, 'MMM dd, yyyy')} 
                  • {aggregation} aggregation
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-gray-600">Loading historical data...</div>
              </div>
            ) : historicalData.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No historical data available for selected period</p>
              </div>
            ) : (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTimestamp}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={(value: any, name: string) => {
                        const dataPoint = dataPoints.find(dp => dp.name === name);
                        return [value, `${name} (${dataPoint?.unit || ''})`];
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
                          dot={{ fill: color, strokeWidth: 2, r: 3 }}
                          connectNulls={false}
                          name={dataPoint?.name || `DataPoint ${index + 1}`}
                        />
                      );
                    })}
                    
                    {/* Add reference lines for min/max values */}
                    {selectedDataPoints.map((dpId) => {
                      const dataPoint = dataPoints.find(dp => dp.id === dpId);
                      if (!dataPoint?.max_value) return null;
                      
                      return (
                        <ReferenceLine 
                          key={`max-${dpId}`}
                          y={dataPoint.max_value} 
                          stroke="red" 
                          strokeDasharray="5 5"
                          label={{ value: `Max: ${dataPoint.max_value}`, position: "topRight" }}
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
      {historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedDataPoints.map((dpId, index) => {
                const dataPoint = dataPoints.find(dp => dp.id === dpId);
                const values = historicalData
                  .map(d => d[dataPoint?.name || ''])
                  .filter(v => v != null);
                
                if (values.length === 0) return null;
                
                const min = Math.min(...values);
                const max = Math.max(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const color = CHART_COLORS[index % CHART_COLORS.length];
                
                return (
                  <div key={dpId} className="p-3 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <h4 className="font-medium text-sm truncate">{dataPoint?.name}</h4>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Min:</span>
                        <span>{min.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max:</span>
                        <span>{max.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg:</span>
                        <span>{avg.toFixed(2)} {dataPoint?.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Points:</span>
                        <span>{values.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}