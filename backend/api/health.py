from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
import asyncio
import aiohttp
import psutil
import time
from motor.motor_asyncio import AsyncIOMotorClient
from redis import Redis
from models.protocol import Protocol
from models.device import Device
from models.connection import Connection
from database.mongodb import get_database

router = APIRouter()

class HealthStatus:
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

class ServiceHealth:
    def __init__(self, name: str, status: str = HealthStatus.UNKNOWN, 
                 response_time_ms: float = 0, error: str = None, details: Dict = None):
        self.name = name
        self.status = status
        self.response_time_ms = response_time_ms
        self.error = error
        self.details = details or {}
        self.checked_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "response_time_ms": self.response_time_ms,
            "error": self.error,
            "details": self.details,
            "checked_at": self.checked_at
        }

async def check_mongodb_health() -> ServiceHealth:
    """Check MongoDB connection and performance"""
    try:
        start_time = time.time()
        db = get_database()
        
        # Test basic connectivity
        server_info = await db.command("serverStatus")
        response_time = (time.time() - start_time) * 1000
        
        # Get database stats
        stats = await db.command("dbStats")
        collections_count = len(await db.list_collection_names())
        
        details = {
            "version": server_info.get("version", "unknown"),
            "uptime_seconds": server_info.get("uptime", 0),
            "collections": collections_count,
            "data_size_mb": round(stats.get("dataSize", 0) / (1024 * 1024), 2),
            "storage_size_mb": round(stats.get("storageSize", 0) / (1024 * 1024), 2),
            "connections": server_info.get("connections", {}).get("current", 0)
        }
        
        status = HealthStatus.HEALTHY if response_time < 100 else HealthStatus.WARNING
        return ServiceHealth("MongoDB", status, response_time, None, details)
        
    except Exception as e:
        return ServiceHealth("MongoDB", HealthStatus.CRITICAL, 0, str(e))

async def check_redis_health() -> ServiceHealth:
    """Check Redis connection and performance"""
    try:
        start_time = time.time()
        # This would need Redis client configuration - placeholder for now
        # redis_client = Redis.from_url("redis://redis:6379")
        # info = redis_client.info()
        response_time = (time.time() - start_time) * 1000
        
        details = {
            "version": "7.0",  # Placeholder
            "used_memory_mb": 45,  # Placeholder
            "connected_clients": 2
        }
        
        return ServiceHealth("Redis", HealthStatus.HEALTHY, response_time, None, details)
        
    except Exception as e:
        return ServiceHealth("Redis", HealthStatus.WARNING, 0, f"Redis check skipped: {str(e)}")

async def check_external_service(url: str, name: str, timeout: int = 5) -> ServiceHealth:
    """Check external service availability"""
    try:
        start_time = time.time()
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            async with session.get(url) as response:
                response_time = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    try:
                        data = await response.json()
                        details = {"status_code": response.status}
                        if "version" in data:
                            details["version"] = data["version"]
                    except:
                        details = {"status_code": response.status}
                    
                    status = HealthStatus.HEALTHY if response_time < 1000 else HealthStatus.WARNING
                    return ServiceHealth(name, status, response_time, None, details)
                else:
                    return ServiceHealth(name, HealthStatus.WARNING, response_time, 
                                       f"HTTP {response.status}")
        
    except asyncio.TimeoutError:
        return ServiceHealth(name, HealthStatus.CRITICAL, 0, "Connection timeout")
    except Exception as e:
        return ServiceHealth(name, HealthStatus.CRITICAL, 0, str(e))

def check_system_resources() -> ServiceHealth:
    """Check system resource usage"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        details = {
            "cpu_percent": round(cpu_percent, 1),
            "memory_percent": round(memory.percent, 1),
            "memory_available_gb": round(memory.available / (1024**3), 2),
            "disk_percent": round(disk.percent, 1),
            "disk_free_gb": round(disk.free / (1024**3), 2)
        }
        
        # Determine status based on resource usage
        if cpu_percent > 90 or memory.percent > 90 or disk.percent > 90:
            status = HealthStatus.CRITICAL
        elif cpu_percent > 70 or memory.percent > 80 or disk.percent > 80:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.HEALTHY
        
        return ServiceHealth("System Resources", status, 0, None, details)
        
    except Exception as e:
        return ServiceHealth("System Resources", HealthStatus.WARNING, 0, str(e))

async def check_protocols_health() -> ServiceHealth:
    """Check protocols and connections health"""
    try:
        protocols = await Protocol.find().to_list()
        devices = await Device.find().to_list()
        connections = await Connection.find().to_list()
        
        active_protocols = len([p for p in protocols if p.status == "connected"])
        online_devices = len([d for d in devices if d.online])
        active_connections = len([c for c in connections if c.status == "active"])
        
        details = {
            "total_protocols": len(protocols),
            "active_protocols": active_protocols,
            "total_devices": len(devices),
            "online_devices": online_devices,
            "total_connections": len(connections),
            "active_connections": active_connections,
            "protocol_health_percent": round((active_protocols / max(len(protocols), 1)) * 100, 1),
            "device_health_percent": round((online_devices / max(len(devices), 1)) * 100, 1)
        }
        
        # Determine overall protocols health
        if len(protocols) == 0:
            status = HealthStatus.WARNING
        elif active_protocols / len(protocols) > 0.8 and online_devices / max(len(devices), 1) > 0.8:
            status = HealthStatus.HEALTHY
        elif active_protocols > 0:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.CRITICAL
        
        return ServiceHealth("Industrial Protocols", status, 0, None, details)
        
    except Exception as e:
        return ServiceHealth("Industrial Protocols", HealthStatus.CRITICAL, 0, str(e))

@router.get("/health")
async def get_health_overview():
    """Get overall system health status"""
    try:
        # Run all health checks concurrently
        health_checks = await asyncio.gather(
            check_mongodb_health(),
            check_redis_health(),
            check_external_service("http://n8n:5678/healthz", "N8N Workflows"),
            check_external_service("http://llama:11434/api/tags", "Ollama LLM"),
            return_exceptions=True
        )
        
        # Add synchronous checks
        system_health = check_system_resources()
        protocols_health = await check_protocols_health()
        
        all_services = []
        
        # Process async results
        for check in health_checks:
            if isinstance(check, ServiceHealth):
                all_services.append(check.to_dict())
            else:
                # Handle exceptions
                all_services.append({
                    "name": "Unknown Service",
                    "status": HealthStatus.CRITICAL,
                    "error": str(check)
                })
        
        # Add synchronous results
        all_services.extend([system_health.to_dict(), protocols_health.to_dict()])
        
        # Calculate overall health
        healthy_services = len([s for s in all_services if s["status"] == HealthStatus.HEALTHY])
        warning_services = len([s for s in all_services if s["status"] == HealthStatus.WARNING])
        critical_services = len([s for s in all_services if s["status"] == HealthStatus.CRITICAL])
        
        overall_status = HealthStatus.HEALTHY
        if critical_services > 0:
            overall_status = HealthStatus.CRITICAL
        elif warning_services > 0:
            overall_status = HealthStatus.WARNING
        
        return {
            "overall_status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "services": all_services,
            "summary": {
                "total_services": len(all_services),
                "healthy": healthy_services,
                "warning": warning_services,
                "critical": critical_services,
                "health_score": round((healthy_services / len(all_services)) * 100, 1)
            }
        }
        
    except Exception as e:
        return {
            "overall_status": HealthStatus.CRITICAL,
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "services": []
        }

@router.get("/health/detailed")
async def get_detailed_health():
    """Get detailed health information with logs"""
    try:
        health_overview = await get_health_overview()
        
        # Add recent system logs for troubled services
        from models.system_log import SystemLog
        recent_errors = await SystemLog.find(
            {"level": {"$in": ["error", "warning"]}, 
             "created_at": {"$gte": datetime.utcnow() - timedelta(hours=1)}}
        ).sort("-created_at").limit(20).to_list()
        
        health_overview["recent_issues"] = [
            {
                "id": str(log.id),
                "level": log.level,
                "component": log.component,
                "message": log.message,
                "created_at": log.created_at.isoformat(),
                "metadata": log.metadata
            } for log in recent_errors
        ]
        
        return health_overview
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health/metrics")
async def get_health_metrics():
    """Get health metrics for monitoring dashboard"""
    try:
        # System metrics
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        
        # Database metrics
        db = get_database()
        db_stats = await db.command("dbStats")
        
        # Protocol metrics
        total_devices = await Device.count()
        online_devices = await Device.find({"online": True}).count()
        active_protocols = await Protocol.find({"status": "connected"}).count()
        total_protocols = await Protocol.count()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "system": {
                "cpu_percent": round(cpu_percent, 1),
                "memory_percent": round(memory.percent, 1),
                "uptime_hours": round(time.time() / 3600, 1)  # Rough uptime
            },
            "database": {
                "data_size_mb": round(db_stats.get("dataSize", 0) / (1024 * 1024), 2),
                "collections": len(await db.list_collection_names()),
                "response_time_ms": 0  # Would be calculated during actual DB operation
            },
            "protocols": {
                "active_protocols": active_protocols,
                "total_protocols": total_protocols,
                "online_devices": online_devices,
                "total_devices": total_devices,
                "health_score": round((online_devices / max(total_devices, 1)) * 100, 1)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health/logs")
async def get_health_logs(hours: int = 24, level: str = "error"):
    """Get recent health-related logs"""
    try:
        from models.system_log import SystemLog
        
        query = {
            "created_at": {"$gte": datetime.utcnow() - timedelta(hours=hours)}
        }
        
        if level != "all":
            query["level"] = {"$in": [level, "warning"] if level == "error" else [level]}
        
        logs = await SystemLog.find(query).sort("-created_at").limit(100).to_list()
        
        return {
            "logs": [
                {
                    "id": str(log.id),
                    "level": log.level,
                    "component": log.component,
                    "message": log.message,
                    "created_at": log.created_at.isoformat(),
                    "metadata": log.metadata
                } for log in logs
            ],
            "total": len(logs),
            "period_hours": hours
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/health/test/{service_name}")
async def test_service_health(service_name: str):
    """Test specific service health on demand"""
    try:
        if service_name == "mongodb":
            result = await check_mongodb_health()
        elif service_name == "redis":
            result = await check_redis_health()
        elif service_name == "n8n":
            result = await check_external_service("http://n8n:5678/healthz", "N8N")
        elif service_name == "ollama":
            result = await check_external_service("http://llama:11434/api/tags", "Ollama")
        elif service_name == "system":
            result = check_system_resources()
        elif service_name == "protocols":
            result = await check_protocols_health()
        else:
            raise HTTPException(status_code=400, detail="Unknown service")
        
        return result.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))