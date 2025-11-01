#!/usr/bin/env python3
"""
Development server runner with explicit CORS configuration
Use this script to run the backend in development mode with proper CORS setup

Usage:
    python run_dev.py
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set environment variables for development
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("PORT", "3001")
os.environ.setdefault("HOST", "0.0.0.0")
os.environ.setdefault("MONGODB_URL", "mongodb://admin:industrial_iot_2024@localhost:27017/industrial_iot?authSource=admin")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

# CRITICAL: Set CORS origins for development
dev_cors_origins = [
    "http://localhost:3000",   # React dev
    "http://localhost:5173",   # Vite dev  
    "http://localhost:80",     # Docker frontend
    "http://localhost",        # Docker frontend alt
    "http://127.0.0.1:3000",   # Localhost alt
    "http://127.0.0.1:5173",   # Localhost alt
    "http://127.0.0.1:80",     # Localhost alt
    "http://127.0.0.1",        # Localhost alt
    "*"  # Allow all origins in development (ONLY for dev!)
]

os.environ["CORS_ORIGINS"] = ",".join(dev_cors_origins)

print("🔧 DEVELOPMENT SERVER CONFIGURATION:")
print(f"📡 Port: {os.environ['PORT']}")
print(f"🏠 Host: {os.environ['HOST']}")
print(f"🗄️ MongoDB: {os.environ['MONGODB_URL']}")
print(f"🔴 Redis: {os.environ['REDIS_URL']}")
print(f"🌐 CORS Origins: {os.environ['CORS_ORIGINS']}")
print("⚠️ WARNING: CORS is set to allow all origins (*) - FOR DEVELOPMENT ONLY!")
print("")

if __name__ == "__main__":
    import uvicorn
    from main import app
    
    print("🚀 Starting Industrial IoT Backend API...")
    print("📖 API Documentation: http://localhost:3001/docs")
    print("🏥 Health Check: http://localhost:3001/health")
    print("📊 Status Endpoint: http://localhost:3001/api/status")
    print("🔌 WebSocket: ws://localhost:3001/ws")
    print("")
    print("🛑 Press Ctrl+C to stop")
    print("" + "="*60)
    
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=3001,
            reload=True,
            log_level="info",
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)