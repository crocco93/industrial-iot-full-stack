# Frontend Development Guidelines
# Industrial Protocols Management API Integration

## Backend API Overview

### Base Information
- **API URL**: `http://localhost:3001` (development) / `http://backend:3001` (Docker)
- **WebSocket URL**: `ws://localhost:3002` (development) / `ws://backend:3002` (Docker)
- **Documentation**: `http://localhost:3001/docs` (OpenAPI/Swagger)
- **Health Check**: `GET /health`

## API Endpoints Structure

### Core Endpoints

#### 1. **Protocols Management** (`/api/protocols`)
```javascript
// Get all protocols
GET /api/protocols
Response: {
  "protocols": [
    {
      "id": "string",
      "name": "string", 
      "type": "modbus-tcp|opc-ua|mqtt|profinet|ethernet-ip|canopen|bacnet",
      "description": "string",
      "status": "connected|disconnected|error",
      "version": "string",
      "configuration": {...},
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}

// Create new protocol
POST /api/protocols
Body: {
  "name": "string",
  "type": "protocol_type",
  "description": "string",
  "configuration": {
    // Protocol-specific configuration
  }
}

// Get specific protocol
GET /api/protocols/{protocol_id}

// Update protocol
PUT /api/protocols/{protocol_id}

// Delete protocol
DELETE /api/protocols/{protocol_id}

// Test protocol connection
POST /api/protocols/{protocol_id}/test
Body: {
  "address": "string",
  "configuration": {...}
}

// Start protocol
POST /api/protocols/{protocol_id}/start

// Stop protocol  
POST /api/protocols/{protocol_id}/stop
```

#### 2. **Connections Management** (`/api/connections`)
```javascript
// Get all connections
GET /api/connections
Response: {
  "connections": [
    {
      "id": "string",
      "name": "string",
      "protocol_id": "string",
      "address": "string",
      "status": "active|inactive|error",
      "last_seen": "2024-01-01T00:00:00Z",
      "statistics": {
        "bytes_transferred": number,
        "messages_count": number,
        "error_count": number,
        "uptime_seconds": number
      }
    }
  ]
}

// Create connection
POST /api/connections

// Get connection details
GET /api/connections/{connection_id}

// Update connection
PUT /api/connections/{connection_id}

// Delete connection
DELETE /api/connections/{connection_id}
```

#### 3. **Data Points Management** (`/api/data-points`)
```javascript
// Get all data points
GET /api/data-points
Response: {
  "data_points": [
    {
      "id": "string",
      "name": "string", 
      "connection_id": "string",
      "address": "string", // Protocol-specific address
      "data_type": "boolean|integer|float|string|binary",
      "access_type": "read|write|read_write",
      "current_value": any,
      "timestamp": "2024-01-01T00:00:00Z",
      "quality": "Good|Bad|Uncertain",
      "configuration": {...}
    }
  ]
}

// Create data point
POST /api/data-points

// Read data point value
GET /api/data-points/{data_point_id}/value

// Write data point value  
POST /api/data-points/{data_point_id}/value
Body: {
  "value": any
}

// Get data point history
GET /api/data-points/{data_point_id}/history?hours=24
```

#### 4. **Real-time Monitoring** (`/api/monitoring`)
```javascript
// Get current monitoring data
GET /api/monitoring/data
Response: {
  "timestamp": "2024-01-01T00:00:00Z",
  "protocols": {
    "modbus-tcp": {
      "bytes_per_second": number,
      "messages_per_second": number, 
      "error_rate": number,
      "latency_ms": number,
      "connection_count": number
    }
    // ... other protocols
  }
}

// Get historical monitoring data
GET /api/monitoring/history?hours=24&protocol=modbus-tcp

// Get system metrics
GET /api/monitoring/metrics
```

#### 5. **System Logs** (`/api/logs`) 
```javascript
// Get logs
GET /api/logs?level=info&source=protocol&limit=100
Response: {
  "logs": [
    {
      "id": "string",
      "timestamp": "2024-01-01T00:00:00Z", 
      "level": "debug|info|warning|error|critical",
      "source": "string",
      "message": "string",
      "metadata": {...}
    }
  ]
}

// Export logs
GET /api/logs/export?format=json|csv&start=2024-01-01&end=2024-01-02
```

#### 6. **Security & Certificates** (`/api/security`)
```javascript
// Upload certificate
POST /api/security/certificates
Body: FormData with certificate file

// Get certificates
GET /api/security/certificates

// Delete certificate
DELETE /api/security/certificates/{cert_id}

// Validate certificate
POST /api/security/certificates/validate
Body: {
  "certificate": "base64_encoded_cert"
}
```

#### 7. **System Settings** (`/api/settings`)
```javascript
// Get settings
GET /api/settings

// Update settings
PUT /api/settings
Body: {
  "monitoring_interval": number,
  "log_level": "debug|info|warning|error",
  "max_connections": number,
  "data_retention_days": number
}
```

## WebSocket Integration

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3002/ws');

// Available channels:
// - /ws/monitoring - Real-time monitoring data
// - /ws/connections - Connection status updates  
// - /ws/logs - Live log streaming
```

### WebSocket Message Types
```javascript
// Connection confirmed
{
  "type": "connection_confirmed",
  "data": {
    "channel": "monitoring",
    "server_time": "2024-01-01T00:00:00Z"
  }
}

// Monitoring data
{
  "type": "monitoring_data", 
  "data": {
    "protocol_id": "string",
    "connection_id": "string",
    "metrics": {
      "bytes_per_second": number,
      "messages_per_second": number,
      "error_rate": number,
      "latency_ms": number
    }
  }
}

// Connection status update
{
  "type": "connection_status_update",
  "data": {
    "connection_id": "string",
    "status": "active|inactive|error",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}

// Log entry
{
  "type": "log_entry",
  "data": {
    "level": "info|warning|error",
    "source": "string", 
    "message": "string",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}

// Heartbeat
{
  "type": "heartbeat",
  "data": {
    "server_time": "2024-01-01T00:00:00Z",
    "active_channels": {
      "monitoring": number,
      "connections": number, 
      "logs": number
    }
  }
}
```

## Protocol-Specific Configuration

### Modbus TCP
```javascript
{
  "host": "192.168.1.100",
  "port": 502,
  "unitId": 1,
  "timeout": 5000
}

// Data point configuration
{
  "functionCode": 3, // 1=Coils, 2=Discrete, 3=Holding, 4=Input
  "registerAddress": 0,
  "registerCount": 1,
  "dataType": "integer|float|boolean"
}
```

### OPC-UA
```javascript
{
  "endpointUrl": "opc.tcp://192.168.1.100:4840",
  "securityMode": "None|Sign|SignAndEncrypt",
  "securityPolicy": "None|Basic256Sha256",
  "username": "optional",
  "password": "optional"
}

// Data point configuration
{
  "nodeId": "ns=2;i=1001",
  "attributeId": "Value"
}
```

### MQTT
```javascript
{
  "brokerHost": "192.168.1.100",
  "brokerPort": 1883,
  "clientId": "client_id",
  "username": "optional",
  "password": "optional",
  "keepAlive": 60,
  "qos": 1,
  "useSSL": false
}

// Data point configuration
{
  "topic": "sensors/temperature",
  "qos": 1,
  "retain": false
}
```

### EtherNet/IP
```javascript
{
  "targetHost": "192.168.1.100", 
  "targetPort": 44818,
  "plcType": "logix|slc|micrologix"
}

// Data point configuration
{
  "tagName": "Program:MainProgram.Temperature",
  "dataType": "DINT|REAL|BOOL|STRING"
}
```

### Profinet
```javascript
{
  "ipAddress": "192.168.1.100",
  "rack": 0,
  "slot": 1,
  "connectionType": "PG|OP|S7_BASIC"
}

// Data point configuration  
{
  "area": "DB|MK|PE|PA", // DataBlock, Memory, ProcessInput, ProcessOutput
  "dbNumber": 1,
  "start": 0,
  "size": 4,
  "dataType": "BOOL|BYTE|WORD|DWORD|INT|DINT|REAL|STRING"
}
```

### CANopen
```javascript
{
  "bustype": "socketcan|virtual",
  "channel": "can0", 
  "bitrate": 250000,
  "nodeId": 1
}

// Data point configuration
{
  "nodeId": 2,
  "index": "0x1001",
  "subindex": 0,
  "dataType": "UNSIGNED8|UNSIGNED16|UNSIGNED32|REAL32"
}
```

### BACnet
```javascript
{
  "deviceId": 12345,
  "localAddress": "192.168.1.100/24",
  "maxApduLength": 1476,
  "segmentationSupported": "segmentedBoth"
}

// Data point configuration
{
  "deviceAddress": "192.168.1.101",
  "objectType": "analogInput|analogOutput|binaryInput|binaryOutput",
  "objectInstance": 0,
  "propertyId": "presentValue"
}
```

## Error Handling

### Standard Error Response Format
```javascript
{
  "detail": "Error message",
  "status_code": 400|401|403|404|500,
  "error_type": "ValidationError|ConnectionError|AuthenticationError|NotFoundError|InternalError",
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/api/protocols",
  "method": "POST"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden  
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (protocol error)
- `500` - Internal Server Error
- `503` - Service Unavailable (protocol service down)

## Frontend Implementation Guidelines

### State Management Recommendations
```javascript
// Suggested state structure
{
  protocols: {
    items: [],
    loading: false,
    error: null,
    selectedProtocol: null
  },
  connections: {
    items: [],
    loading: false, 
    error: null
  },
  dataPoints: {
    items: [],
    realTimeValues: {},
    loading: false,
    error: null
  },
  monitoring: {
    currentData: {},
    historicalData: [],
    isConnected: false
  },
  logs: {
    items: [],
    filters: {
      level: 'all',
      source: 'all',
      limit: 100
    },
    autoScroll: true
  }
}
```

### WebSocket Connection Management
```javascript
class ProtocolWebSocket {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectInterval);
    }
  }
}
```

### API Client Example
```javascript
class ProtocolApiClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };
    
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'API request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
  
  // Protocol methods
  async getProtocols() {
    return this.request('/api/protocols');
  }
  
  async createProtocol(protocol) {
    return this.request('/api/protocols', {
      method: 'POST',
      body: JSON.stringify(protocol)
    });
  }
  
  async testConnection(protocolId, config) {
    return this.request(`/api/protocols/${protocolId}/test`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }
}
```

### Real-time Data Updates
```javascript
// Example React hook for real-time monitoring
function useMonitoring() {
  const [monitoringData, setMonitoringData] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002/ws/monitoring');
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'monitoring_data') {
        setMonitoringData(prev => ({
          ...prev,
          [message.data.protocol_id]: message.data.metrics
        }));
      }
    };
    
    return () => ws.close();
  }, []);
  
  return { monitoringData, isConnected };
}
```

### UI Components Suggestions

1. **Protocol Configuration Forms**
   - Dynamic forms based on protocol type
   - Validation for protocol-specific fields
   - Connection testing before saving

2. **Real-time Monitoring Dashboard**
   - Charts for metrics (bytes/sec, messages/sec, error rate)
   - Connection status indicators
   - Protocol-specific dashboards

3. **Data Points Management**
   - Tree view for hierarchical data (OPC-UA nodes, Modbus registers)
   - Real-time value updates
   - Batch operations for multiple data points

4. **Logs Viewer**
   - Filterable log viewer
   - Real-time log streaming
   - Export functionality
   - Log level color coding

5. **Connection Management**
   - Connection topology visualization
   - Health status indicators
   - Quick connect/disconnect actions

### Performance Considerations

1. **Pagination** - Use for large datasets (connections, data points, logs)
2. **Virtual Scrolling** - For large lists
3. **Debouncing** - For search and filter inputs
4. **Caching** - Cache protocol configurations and static data
5. **WebSocket Management** - Proper connection lifecycle management
6. **Error Boundaries** - Graceful error handling in React components

### Security Considerations

1. **Authentication** - Implement JWT token handling
2. **HTTPS** - Use secure connections in production
3. **Input Validation** - Validate all user inputs
4. **Certificate Management** - Secure certificate upload/storage
5. **Permission System** - Role-based access control

This documentation should provide a comprehensive reference for frontend development against your Industrial Protocols Management API.