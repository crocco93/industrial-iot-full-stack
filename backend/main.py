from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv
from datetime import datetime
from database.mongodb import init_database, close_database
from api import protocols, connections, monitoring, logs, security, settings, websocket, data_points, integrations
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
app.include_router(monitoring.router, prefix="/api", tags=["monitoring"])
app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(security.router, prefix="/api", tags=["security"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
app.include_router(data_points.router, prefix="/api", tags=["data-points"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])  # ✅ DODANE

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
        "documentation": "/docs",
        "openapi": "/openapi.json"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
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
                "websocket_manager": "running"
            },
            "statistics": {
                "active_protocols": len(protocol_status),
                "websocket_connections": ws_stats["total_connections"],
                "websocket_channels": ws_stats["channels"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.get("/api/status")
async def api_status():
    """Get detailed API status"""
    try:
        # Get protocol manager status
        protocol_status = protocol_manager.get_all_protocol_status()
        
        # Get protocol service status
        from services.protocol_services import get_available_protocols
        available_protocols = get_available_protocols()
        
        # Get database statistics
        try:
            from models.protocol import Protocol
            from models.connection import Connection
            from models.monitoring import MonitoringData
            
            total_protocols = await Protocol.count()
            total_connections = await Connection.count()
            
            # Recent monitoring data (last hour)
            from datetime import timedelta
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_monitoring = await MonitoringData.find(
                MonitoringData.timestamp >= one_hour_ago
            ).count()
            
            db_stats = {
                "total_protocols": total_protocols,
                "total_connections": total_connections,
                "monitoring_data_last_hour": recent_monitoring
            }
        except Exception as e:
            # If database is not available, provide mock stats
            db_stats = {
                "total_protocols": 0,
                "total_connections": 0,
                "monitoring_data_last_hour": 0,
                "note": f"Database unavailable: {e}"
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
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3001))
    host = os.getenv("HOST", "0.0.0.0")
    environment = os.getenv("ENVIRONMENT", "development")
    
    print(f"🔧 Starting server on {host}:{port} in {environment} mode")
    print(f"📡 Supported protocols: Modbus TCP, OPC-UA, Profinet, EtherNet/IP, MQTT, CANopen, BACnet")
    print(f"🔗 Integrations: N8N Workflows, Ollama LLM")
    print(f"🌐 API Documentation: http://{host}:{port}/docs")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True if environment == "development" else False,
        log_level="info"
    )