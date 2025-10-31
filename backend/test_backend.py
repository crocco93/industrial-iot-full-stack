#!/usr/bin/env python3
"""
Test version of the backend that can run without MongoDB for demonstration
"""
import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import random
import json

app = FastAPI(
    title="Industrial Protocols Management API - Test Version",
    description="Test backend for industrial protocols management",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data storage
mock_protocols = [
    {
        "id": "507f1f77bcf86cd799439011",
        "name": "Modbus TCP Main",
        "type": "modbus-tcp",
        "description": "Główny protokół Modbus TCP",
        "status": "connected",
        "version": "1.0",
        "configuration": {"host": "192.168.1.100", "port": 502},
        "devices": [
            {
                "id": "507f1f77bcf86cd799439012",
                "name": "PLC-001",
                "description": "Główny sterownik produkcji",
                "address": "192.168.1.100",
                "status": "active",
                "readFrequency": 1000,
                "dataPoints": [
                    {
                        "id": "507f1f77bcf86cd799439013",
                        "name": "Temperature_1", 
                        "description": "Temperatura w strefie 1",
                        "dataType": "float",
                        "address": "40001",
                        "configuration": {"functionCode": 3, "registerAddress": 40001},
                        "unit": "°C",
                        "scaling": {"factor": 0.1, "offset": 0},
                        "limits": {"min": -50, "max": 150},
                        "enabled": True,
                        "createdAt": "2024-01-01T00:00:00Z",
                        "updatedAt": "2024-01-01T00:00:00Z"
                    }
                ]
            }
        ],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
    },
    {
        "id": "507f1f77bcf86cd799439014", 
        "name": "OPC-UA Server",
        "type": "opc-ua",
        "description": "Serwer OPC-UA SCADA",
        "status": "disconnected",
        "version": "1.0",
        "configuration": {"endpointUrl": "opc.tcp://192.168.1.101:4840"},
        "devices": [],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
    }
]

mock_connections = [
    {
        "id": "507f1f77bcf86cd799439015",
        "name": "PLC Connection",
        "protocol_id": "507f1f77bcf86cd799439011",
        "address": "192.168.1.100:502",
        "status": "active",
        "last_seen": "2024-01-01T12:00:00Z",
        "data_rate": "1.2 kB/s",
        "bytes_transferred": 1024000,
        "error_count": 0,
        "configuration": {"timeout": 5000},
        "protocol": mock_protocols[0],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
]

def generate_mock_monitoring_data():
    return {
        "id": "507f1f77bcf86cd79943901" + str(random.randint(6, 9)),
        "timestamp": datetime.now().isoformat(),
        "protocol_id": "507f1f77bcf86cd799439011",
        "connection_id": "507f1f77bcf86cd799439015",
        "metrics": {
            "bytes_per_second": round(random.uniform(100, 2000), 2),
            "messages_per_second": round(random.uniform(10, 100), 2),
            "error_rate": round(random.uniform(0, 0.1), 3),
            "latency": round(random.uniform(10, 100), 2),
            "connection_count": random.randint(1, 5)
        }
    }

def generate_mock_log():
    levels = ["info", "warning", "error", "debug"]
    sources = ["system", "protocol.modbus", "protocol.opcua", "database"]
    return {
        "id": "507f1f77bcf86cd79943902" + str(random.randint(0, 9)),
        "timestamp": datetime.now().isoformat(),
        "level": random.choice(levels),
        "source": random.choice(sources),
        "message": f"Mock log message {random.randint(1000, 9999)}",
        "metadata": {"component": "test", "session_id": "test_session"}
    }

# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "Industrial Protocols Management API - Test Version",
        "version": "1.0.0",
        "status": "running",
        "supported_protocols": ["modbus-tcp", "opc-ua", "profinet", "ethernet-ip", "mqtt", "canopen", "bacnet"]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Test backend is running",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "mock",
            "protocol_manager": "running",
            "websocket_manager": "running"
        }
    }

@app.get("/api/protocols")
async def get_protocols():
    return mock_protocols

@app.get("/api/protocols/{protocol_id}")
async def get_protocol(protocol_id: str):
    protocol = next((p for p in mock_protocols if p["id"] == protocol_id), None)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return protocol

@app.post("/api/protocols")
async def create_protocol(protocol_data: dict):
    new_protocol = {
        "id": "507f1f77bcf86cd79943901" + str(random.randint(0, 9)),
        "name": protocol_data.get("name", "New Protocol"),
        "type": protocol_data.get("type", "modbus-tcp"),
        "description": protocol_data.get("description", ""),
        "status": "disconnected",
        "version": "1.0",
        "configuration": protocol_data.get("configuration", {}),
        "devices": [],
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }
    mock_protocols.append(new_protocol)
    return new_protocol

@app.put("/api/protocols/{protocol_id}")
async def update_protocol(protocol_id: str, protocol_data: dict):
    protocol = next((p for p in mock_protocols if p["id"] == protocol_id), None)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    
    for key, value in protocol_data.items():
        if key in protocol:
            protocol[key] = value
    protocol["updatedAt"] = datetime.now().isoformat()
    return protocol

@app.delete("/api/protocols/{protocol_id}")
async def delete_protocol(protocol_id: str):
    global mock_protocols
    mock_protocols = [p for p in mock_protocols if p["id"] != protocol_id]
    return {"success": True, "message": "Protocol deleted successfully"}

@app.get("/api/connections")
async def get_connections():
    return mock_connections

@app.post("/api/connections/{connection_id}/test")
async def test_connection(connection_id: str):
    success = random.choice([True, True, True, False])  # 75% success rate
    return {
        "success": success,
        "message": "Connection test successful" if success else "Connection test failed"
    }

@app.get("/api/monitoring")
async def get_monitoring_data():
    # Generate 10 recent monitoring data points
    data = [generate_mock_monitoring_data() for _ in range(10)]
    return data

@app.get("/api/monitoring/metrics")
async def get_metrics(range: str = "1h"):
    protocols_count = len(mock_protocols)
    active_protocols = len([p for p in mock_protocols if p["status"] == "connected"])
    
    return {
        "timeRange": range,
        "totalProtocols": protocols_count,
        "activeProtocols": active_protocols,
        "aggregatedMetrics": {
            "bytesPerSecond": round(random.uniform(500, 3000), 2),
            "messagesPerSecond": round(random.uniform(50, 200), 2),
            "errorRate": round(random.uniform(0, 0.05), 3),
            "latency": round(random.uniform(20, 80), 2),
            "connectionCount": len(mock_connections)
        },
        "protocolMetrics": {
            "507f1f77bcf86cd799439011": {
                "name": "Modbus TCP Main",
                "type": "modbus-tcp",
                "status": "connected",
                "bytesPerSecond": round(random.uniform(800, 1500), 2),
                "messagesPerSecond": round(random.uniform(40, 80), 2),
                "errorRate": round(random.uniform(0, 0.02), 3),
                "latency": round(random.uniform(15, 50), 2),
                "dataPoints": 50
            }
        },
        "dataPoints": 50
    }

@app.get("/api/logs")
async def get_logs(level: str = None, source: str = None, page: int = 1, limit: int = 50):
    # Generate mock logs
    logs = [generate_mock_log() for _ in range(limit)]
    
    # Apply filters
    if level:
        logs = [log for log in logs if log["level"] == level]
    if source:
        logs = [log for log in logs if log["source"] == source]
    
    total = len(logs)
    return {
        "success": True,
        "data": logs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit
        }
    }

@app.get("/api/security/certificates")
async def get_certificates():
    return [
        {
            "id": "507f1f77bcf86cd799439020",
            "name": "Root CA Certificate",
            "type": "ca",
            "status": "valid",
            "subject": "CN=Root CA",
            "issuer": "CN=Root CA",
            "valid_from": "2024-01-01T00:00:00Z",
            "valid_to": "2025-01-01T00:00:00Z",
            "fingerprint": "SHA1:A1B2C3D4E5F6"
        }
    ]

@app.get("/api/settings")
async def get_settings():
    return [
        {
            "id": "507f1f77bcf86cd799439030",
            "category": "general",
            "key": "system_name",
            "value": "Industrial Protocols Management System",
            "description": "System name",
            "updated_at": datetime.now().isoformat()
        }
    ]

@app.get("/api/system/info")
async def get_system_info():
    return {
        "system": {
            "name": "Industrial Protocols Management System",
            "version": "1.0.0",
            "uptime": "Running",
            "status": "healthy"
        },
        "statistics": {
            "total_protocols": len(mock_protocols),
            "total_connections": len(mock_connections),
            "active_connections": len([c for c in mock_connections if c["status"] == "active"]),
            "monitoring_data_points_last_hour": 150,
            "log_entries_last_hour": 25
        },
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    print("🚀 Starting Industrial Protocols Management API - Test Version...")
    print("📡 Supported protocols: Modbus TCP, OPC-UA, Profinet, EtherNet/IP, MQTT, CANopen, BACnet")
    print("🌐 API Documentation: http://localhost:3001/docs")
    print("💻 Test frontend at: http://localhost:3000")
    
    uvicorn.run(
        "test_backend:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
        log_level="info"
    )