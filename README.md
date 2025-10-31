# Industrial IoT Management System
Complete full-stack application for managing industrial communication protocols

## 🏗️ Architecture

### Backend (FastAPI + WebSocket)
- **7 Industrial Protocols**: Modbus TCP, OPC-UA, MQTT, EtherNet/IP, Profinet, CANopen, BACnet
- **Real-time Communication**: WebSocket with heartbeat
- **Database**: MongoDB with connection pooling
- **Cache**: Redis for performance
- **Authentication**: JWT tokens
- **API Documentation**: OpenAPI/Swagger

### Frontend (React + TypeScript + Vite)
- **Hierarchical Structure**: Location → [Infrastructure Devices] + Areas → [Production Devices] → Data Points
- **Real-time Updates**: WebSocket integration with auto-reconnection
- **Protocol Management**: Forms for all 7 protocols
- **Data Visualization**: Historical charts, real-time gauges
- **Data Scaling**: Offset, multiplier, unit conversion
- **Export Functionality**: CSV, JSON data export

### Integrations
- **N8N**: Workflow automation and webhook handling
- **Ollama**: Local LLM integration for industrial insights
- **Prometheus + Grafana**: Metrics and monitoring (optional)

## 🚀 Quick Start

### Core System (Recommended)
```bash
cd industrial-iot-full-stack
docker-compose up --build
```

### Full System (with N8N, LLM, Monitoring)
```bash
docker-compose --profile full up --build
```

## 📱 Access Points
- Frontend: http://localhost
- Backend API: http://localhost/api
- N8N: http://localhost:5678 (admin/industrial_n8n_2024)
- Ollama LLM: http://localhost:11434
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/industrial_grafana_2024)

## 🔌 Supported Protocols

| Protocol | Port | Use Cases | Configuration |
|----------|------|-----------|---------------|
| Modbus TCP | 502 | PLCs, Power meters | Host, Port, Unit ID |
| OPC-UA | 4840 | SCADA, Data historians | Endpoint, Security, Certificates |
| MQTT | 1883 | IoT sensors, Monitoring | Broker, Topics, QoS |
| EtherNet/IP | 44818 | Allen-Bradley PLCs | Host, Tags, PLC Type |
| Profinet | 102 | Siemens equipment | IP, Rack/Slot, DB blocks |
| CANopen | - | Motor drives, Motion | CAN interface, Node ID |
| BACnet | 47808 | HVAC, Building automation | Device ID, Objects |

## 🏭 Enhanced Hierarchical Structure

```
📍 Location (Factory, Plant, Site)
├── 🔌 Infrastructure Devices (Power meters, HVAC, Water)
└── 🏭 Areas (Production Lines, Workshops, Zones)
    └── 📱 Production Devices (PLCs, Robots, Sensors)
        └── 📊 Data Points (Temperature, Pressure, Speed)
```

### Device Categories
- **Infrastructure**: Main power meters, HVAC systems, water monitors, security systems
- **Production**: PLCs, industrial robots, quality scanners, packaging systems

## 🔄 Data Flow

1. **Frontend** → API calls → **Backend**
2. **Backend** → Protocol services → **Industrial devices**
3. **WebSocket** → Real-time updates → **Frontend**
4. **N8N** → Workflows triggered by → **System events**
5. **LLM** → Analysis requests from → **Frontend**

## 📊 Features

### Real-time Monitoring
- Protocol performance metrics
- Connection health status
- System resource usage
- Alert management

### Historical Analysis
- Time-series data visualization
- Multi-variable charting
- Statistical analysis
- Data export (CSV, JSON)

### Workflow Automation (N8N)
- Temperature alerts → Email notifications
- Daily production reports → PDF generation
- Equipment maintenance → Work order creation

### AI Assistant (Local LLM)
- Production data analysis
- Energy optimization insights
- Predictive maintenance recommendations

Created: October 31, 2025