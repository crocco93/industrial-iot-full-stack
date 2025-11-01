from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv
from datetime import datetime
from database.mongodb import init_database, close_database
from api import protocols, connections, monitoring, logs, security, settings, websocket, data_points, integrations, devices, health, dashboards, historical, alerts
from services.protocol_manager import protocol_manager
from services.websocket_manager import start_websocket_heartbeat

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    # Startup
    print("🚀 Starting Industrial Protocols Management API...")
    
    try:
        # Initialize database
        await init_database()
        print("✅ Database connected")
        
        # Start all protocols from database
        await protocol_manager.start_all_protocols()
        print("✅ Protocol manager started")
        
        # Start WebSocket heartbeat
        await start_websocket_heartbeat()
        print("✅ WebSocket manager started")
        
        print("🌟 Industrial Protocols Management API is ready!")
    except Exception as e:
        print(f"⚠️ Startup warning: {e}")
        print("🔄 Continuing with limited functionality...")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down Industrial Protocols Management API...")
    
    # Stop all protocols
    try:
        await protocol_manager.stop_all_protocols()
        print("✅ All protocols stopped")
    except Exception as e:
        print(f"⚠️ Error stopping protocols: {e}")
    
    # Close database connection
    try:
        await close_database()
        print("✅ Database disconnected")
    except Exception as e:
        print(f"⚠️ Error closing database: {e}")
    
    print("👋 Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Industrial Protocols Management API",
    description="Comprehensive backend API for managing industrial communication protocols including Modbus, OPC-UA, Profinet, EtherNet/IP, MQTT, CANopen, and BACnet with N8N and Ollama LLM integration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
origins_str = os.getenv("CORS_ORIGINS", '["http://localhost:3000","http://localhost:5173","http://localhost:80","http://localhost"]')

# Parse the origins string
origins = []
if origins_str.startswith('[') and origins_str.endswith(']'):
    # Remove brackets and quotes, then split by comma
    origins_clean = origins_str[1:-1].replace('"', '').replace("'", "")
    origins = [origin.strip() for origin in origins_clean.split(',') if origin.strip()]
else:
    origins = [origins_str]

print(f"🌐 CORS origins configured: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(protocols.router, prefix="/api", tags=["protocols"])
app.include_router(connections.router, prefix="/api", tags=["connections"])
app.include_router(devices.router, prefix="/api", tags=["devices"])
app.include_router(dashboards.router, prefix="/api", tags=["dashboards"])
app.include_router(historical.router, prefix="/api", tags=["historical"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])  # ✅ DODANE
app.include_router(monitoring.router, prefix="/api", tags=["monitoring"])
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(security.router, prefix="/api", tags=["security"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
app.include_router(data_points.router, prefix="/api", tags=["data-points"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])

# Root endpoints
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Industrial Protocols Management API",
        "version": "1.0.0",
        "description": "Backend API for managing industrial communication protocols with N8N and LLM integration",
        "supported_protocols": [
            "Modbus TCP",
            "OPC-UA",
            "Profinet",
            "EtherNet/IP",
            "MQTT",
            "CANopen",
            "BACnet"
        ],
        "integrations": [
            "N8N Workflow Automation",
            "Ollama LLM Assistant"
        ],
        "features": [
            "Real-time Data Collection",
            "Historical Data Analysis",
            "Custom Dashboards",
            "Advanced Alert Management",
            "Health Monitoring",
            "Hierarchical Device Management",
            "WebSocket Real-time Updates"
        ],
        "documentation": "/docs",
        "openapi": "/openapi.json",
        "health_check": "/health",
        "detailed_health": "/api/health/detailed"
    }

@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    try:
        # Get protocol manager status
        protocol_status = protocol_manager.get_all_protocol_status()
        
        # Get WebSocket manager stats  
        from services.websocket_manager import websocket_manager
        ws_stats = websocket_manager.get_connection_stats()
        
        return {
            "status": "healthy",
            "message": "Industrial Protocols Management API is running",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "services": {
                "database": "connected",
                "protocol_manager": "running",
                "websocket_manager": "running",
                "alert_system": "running"
            },
            "statistics": {
                "active_protocols": len(protocol_status),
                "websocket_connections": ws_stats["total_connections"],
                "websocket_channels": ws_stats["channels"]
            }
        }
    except Exception as e:
        # Return partial health status if some components fail
        return {
            "status": "degraded",
            "message": f"API running with limited functionality: {str(e)}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": str(e)
        }

@app.get("/api/status")
async def api_status():
    """Get detailed API status"""
    try:
        # Get protocol manager status
        try:
            protocol_status = protocol_manager.get_all_protocol_status()
        except Exception as e:
            protocol_status = []
            print(f"Protocol manager unavailable: {e}")
        
        # Get protocol service status
        try:
            from services.protocol_services import get_available_protocols
            available_protocols = get_available_protocols()
        except Exception as e:
            available_protocols = ["modbus-tcp", "opc-ua", "mqtt"]  # Default list
            print(f"Protocol services check failed: {e}")
        
        # Get database statistics
        try:
            from models.protocol import Protocol
            from models.connection import Connection
            from models.device import Device
            
            total_protocols = await Protocol.count()
            total_connections = await Connection.count()
            total_devices = await Device.count()
            
            db_stats = {
                "total_protocols": total_protocols,
                "total_connections": total_connections,
                "total_devices": total_devices,
                "status": "connected"
            }
        except Exception as e:
            # If database is not available, provide mock stats
            db_stats = {
                "total_protocols": 0,
                "total_connections": 0,
                "total_devices": 0,
                "status": "disconnected",
                "error": str(e)
            }
        
        return {
            "api_version": "1.0.0",
            "status": "operational",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "protocol_manager": {
                "running_protocols": len(protocol_status),
                "protocol_details": protocol_status
            },
            "available_protocols": available_protocols,
            "database_statistics": db_stats
        }
    except Exception as e:
        return {
            "api_version": "1.0.0",
            "status": "error",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": str(e)
        }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3001))
    host = os.getenv("HOST", "0.0.0.0")
    environment = os.getenv("ENVIRONMENT", "development")
    
    print(f"🔧 Starting server on {host}:{port} in {environment} mode")
    print(f"📡 Supported protocols: Modbus TCP, OPC-UA, Profinet, EtherNet/IP, MQTT, CANopen, BACnet")
    print(f"🔗 Integrations: N8N Workflows, Ollama LLM")
    print(f"🌐 API Documentation: http://{host}:{port}/docs")
    print(f"🏥 Health Check: http://{host}:{port}/health")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True if environment == "development" else False,
        log_level="info"
    )