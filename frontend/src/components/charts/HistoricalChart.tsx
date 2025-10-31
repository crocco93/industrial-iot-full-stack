import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TimeRangeSelector } from './TimeRangeSelector';
import { DataExport } from './DataExport';

const generateMockData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      power: 1200 + Math.sin(i * 0.5) * 200 + Math.random() * 100,
      temperature: 22 + Math.sin(i * 0.3) * 3 + Math.random() * 2,
      flow: 45 + Math.cos(i * 0.4) * 10 + Math.random() * 5,
    });
  }
  
  return data;
};

export const HistoricalChart: React.FC = () => {
  const [selectedRange, setSelectedRange] = React.useState('24h');
  const [data] = React.useState(generateMockData());

  const handleExportCSV = () => {
    console.log('Exporting CSV...');
    // Implementation for CSV export
  };

  const handleExportJSON = () => {
    console.log('Exporting JSON...');
    // Implementation for JSON export
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Historical Data Trends</h3>
        <div className="flex items-center space-x-4">
          <TimeRangeSelector 
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
          />
          <DataExport 
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
          />
        </div>
      </div>
      
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              yAxisId="left"
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#666"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #ccc',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="power" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Power (kW)"
              dot={false}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="temperature" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Temperature (°C)"
              dot={false}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="flow" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Flow (L/min)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};