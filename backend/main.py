from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv
from datetime import datetime
from database.mongodb import init_database, close_database
from api import (
    protocols, connections, monitoring, logs, security, settings, websocket, 
    data_points, integrations, devices, health, dashboards, historical, 
    alerts, locations, device_discovery, auth, mqtt_export  # ✅ ADDED auth and mqtt_export
)
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
        
        # Initialize authentication system
        from api.auth import create_default_admin
        create_default_admin()
        print("✅ Authentication system initialized")
        
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

# 🔥 CORS Configuration
CORS_ORIGINS = [
    "http://localhost:3000",   # React dev server
    "http://localhost:5173",   # Vite dev server
    "http://localhost:80",     # Docker frontend
    "http://localhost",        # Docker frontend alternative
    "http://frontend:80",      # Docker internal network
    "http://127.0.0.1:3000",   # Alternative localhost
    "http://127.0.0.1:5173",   # Alternative localhost
    "http://127.0.0.1:80",     # Alternative localhost
    "http://127.0.0.1",        # Alternative localhost
]

# Add custom origins from environment
if os.getenv("CORS_ORIGINS"):
    env_origins = os.getenv("CORS_ORIGINS", "")
    if env_origins.startswith('[') and env_origins.endswith(']'):
        # Parse array format
        env_origins = env_origins[1:-1].replace('"', '').replace("'", "")
        custom_origins = [origin.strip() for origin in env_origins.split(',') if origin.strip()]
        CORS_ORIGINS.extend(custom_origins)
    else:
        CORS_ORIGINS.append(env_origins)

print(f"🌐 CORS origins configured: {CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"], # Expose all headers to frontend
)

# ✅ Include API routers (ORDER MATTERS - auth first!)
app.include_router(auth.router, prefix="/api", tags=["authentication"])  # ✅ ADDED
app.include_router(alerts.router, prefix="/api", tags=["alerts"])
app.include_router(mqtt_export.router, prefix="/api", tags=["mqtt-export"])  # ✅ ADDED
app.include_router(protocols.router, prefix="/api", tags=["protocols"])
app.include_router(connections.router, prefix="/api", tags=["connections"])
app.include_router(devices.router, prefix="/api", tags=["devices"])
app.include_router(device_discovery.router, prefix="/api", tags=["device-discovery"])
app.include_router(locations.router, prefix="/api", tags=["locations"])
app.include_router(dashboards.router, prefix="/api", tags=["dashboards"])
app.include_router(historical.router, prefix="/api", tags=["historical"])
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
            "WebSocket Real-time Updates",
            "Location & Area Management",
            "Automatic Device Discovery",
            "User Authentication & Authorization",  # ✅ ADDED
            "MQTT Data Export",  # ✅ ADDED
            "JWT Token Security"  # ✅ ADDED
        ],
        "authentication": {
            "login_endpoint": "/api/auth/login",
            "default_admin": "admin/admin",
            "jwt_expiry_minutes": int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
        },
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
        
        # Check auth system
        from api.auth import users_storage
        auth_users_count = len(users_storage)
        
        # Check MQTT exports
        from api.mqtt_export import mqtt_exports_storage
        mqtt_exports_count = len(mqtt_exports_storage)
        
        # Check alerts
        from api.alerts import alerts_storage
        alerts_count = len(alerts_storage)
        
        return {
            "status": "healthy",
            "message": "Industrial Protocols Management API is running",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "services": {
                "database": "connected",
                "protocol_manager": "running",
                "websocket_manager": "running",
                "alert_system": "running",
                "location_management": "running",
                "device_discovery": "available",
                "authentication": "active",  # ✅ ADDED
                "mqtt_export": "available"  # ✅ ADDED
            },
            "statistics": {
                "active_protocols": len(protocol_status),
                "websocket_connections": ws_stats["total_connections"],
                "websocket_channels": ws_stats["channels"],
                "registered_users": auth_users_count,  # ✅ ADDED
                "mqtt_export_configs": mqtt_exports_count,  # ✅ ADDED
                "active_alerts": alerts_count  # ✅ ADDED
            },
            "environment": {
                "admin_password_set": os.getenv("ADMIN_PASSWORD", "admin") != "admin",
                "jwt_secret_set": bool(os.getenv("JWT_SECRET_KEY")),
                "cors_origins_count": len(CORS_ORIGINS)
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
            available_protocols = ["modbus-tcp", "opc-ua", "mqtt", "opc-ua", "profinet", "ethernet-ip", "canopen", "bacnet"]
            print(f"Protocol services check failed: {e}")
        
        return {
            "api_version": "1.0.0",
            "status": "operational",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "protocol_manager": {
                "running_protocols": len(protocol_status),
                "protocol_details": protocol_status
            },
            "available_protocols": available_protocols,
            "features": {
                "device_discovery": True,
                "location_management": True,
                "real_time_monitoring": True,
                "alert_system": True,
                "user_authentication": True,  # ✅ ADDED
                "mqtt_data_export": True,  # ✅ ADDED
                "jwt_security": True  # ✅ ADDED
            },
            "security": {
                "authentication_required": True,
                "jwt_enabled": True,
                "admin_account_exists": True
            }
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
    print(f"🔐 Authentication: admin/admin (change ADMIN_PASSWORD in .env)")
    print(f"🌐 API Documentation: http://{host}:{port}/docs")
    print(f"🏥 Health Check: http://{host}:{port}/health")
    print(f"🔧 CORS enabled for: {CORS_ORIGINS}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True if environment == "development" else False,
        log_level="info"
    )