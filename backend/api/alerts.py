from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import logging
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning" 
    INFO = "info"

class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    MUTED = "muted"

class SystemAlert(BaseModel):
    id: Optional[str] = None
    type: str = Field(description="Alert type")
    title: str = Field(description="Alert title")
    message: str = Field(description="Alert message")
    severity: AlertSeverity = Field(default=AlertSeverity.INFO)
    status: AlertStatus = Field(default=AlertStatus.ACTIVE)
    source: str = Field(default="system", description="Alert source")
    source_type: str = Field(default="system", description="Source type: device, protocol, system")
    source_name: str = Field(default="System", description="Human readable source name")
    category: str = Field(default="general", description="Alert category")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    acknowledged: bool = Field(default=False, description="Whether alert is acknowledged")
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved: bool = Field(default=False, description="Whether alert is resolved")
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    muted_until: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default={}, description="Additional alert data")
    actions_taken: List[str] = Field(default=[], description="Actions that were executed")
    
class AlertCreateRequest(BaseModel):
    type: str
    title: str
    message: str
    severity: AlertSeverity = AlertSeverity.INFO
    source: str = "manual"
    source_type: str = "system"
    source_name: str = "System"
    category: str = "general"
    metadata: Dict[str, Any] = {}

class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = "user"
    notes: Optional[str] = None

class AlertResolveRequest(BaseModel):
    resolved_by: str = "user"
    resolution_notes: Optional[str] = None

# In-memory storage for development
alerts_storage: Dict[str, SystemAlert] = {}

def create_sample_alerts() -> List[SystemAlert]:
    """Create sample alerts for development"""
    now = datetime.utcnow()
    
    sample_alerts = [
        SystemAlert(
            id="alert_001",
            type="connection_timeout",
            title="Połączenie przeterminowane",
            message="Połączenie Modbus TCP do PLC-001 (192.168.1.100) przeterminowało się po 5 sekundach",
            severity=AlertSeverity.ERROR,
            status=AlertStatus.ACTIVE,
            source="modbus_service",
            source_type="protocol",
            source_name="Modbus TCP PLC-001",
            category="connection",
            timestamp=now - timedelta(minutes=5),
            metadata={
                "device_id": "PLC-001",
                "protocol": "modbus-tcp",
                "address": "192.168.1.100:502",
                "timeout_duration": 5000
            }
        ),
        SystemAlert(
            id="alert_002",
            type="data_quality",
            title="Wysoka temperatura",
            message="Czujnik temperatury wskazuje 85.2°C - przekroczono próg 80°C",
            severity=AlertSeverity.WARNING,
            status=AlertStatus.ACTIVE,
            source="monitoring_system",
            source_type="device",
            source_name="Czujnik TEMP_001",
            category="threshold",
            timestamp=now - timedelta(minutes=2),
            metadata={
                "sensor_id": "TEMP_001",
                "location": "area_production_001",
                "current_value": 85.2,
                "threshold_value": 80.0,
                "unit": "celsius"
            }
        ),
        SystemAlert(
            id="alert_003",
            type="system_startup",
            title="System uruchomiony",
            message="System Industrial IoT uruchomiony pomyślnie z 6 skonfigurowanymi protokołami",
            severity=AlertSeverity.INFO,
            status=AlertStatus.ACKNOWLEDGED,
            source="system",
            source_type="system",
            source_name="Industrial IoT System",
            category="system",
            timestamp=now - timedelta(hours=1),
            acknowledged=True,
            acknowledged_at=now - timedelta(minutes=58),
            acknowledged_by="admin",
            metadata={
                "protocols_count": 6,
                "startup_time_ms": 12500,
                "version": "1.0.0"
            }
        ),
        SystemAlert(
            id="alert_004",
            type="device_offline",
            title="Urządzenie offline",
            message="Serwer OPC-UA (OPCUA_SERVER_001) nie odpowiada od 30 minut",
            severity=AlertSeverity.CRITICAL,
            status=AlertStatus.ACTIVE,
            source="opcua_service",
            source_type="protocol",
            source_name="OPC-UA Server 001",
            category="connection",
            timestamp=now - timedelta(minutes=30),
            metadata={
                "device_id": "OPCUA_SERVER_001",
                "protocol": "opc-ua",
                "endpoint": "opc.tcp://192.168.1.101:4840",
                "last_seen": (now - timedelta(minutes=35)).isoformat(),
                "downtime_minutes": 30
            }
        ),
        SystemAlert(
            id="alert_005",
            type="performance_warning",
            title="Wysokie zużycie zasobów",
            message="Zużycie pamięci RAM przekroczyło 80% - obecnie 87.3% (14.2GB/16GB)",
            severity=AlertSeverity.WARNING,
            status=AlertStatus.ACTIVE,
            source="system_monitor",
            source_type="system",
            source_name="System Monitor",
            category="performance",
            timestamp=now - timedelta(minutes=8),
            metadata={
                "memory_usage_percent": 87.3,
                "memory_used_gb": 14.2,
                "memory_total_gb": 16.0,
                "threshold_percent": 80.0,
                "cpu_usage_percent": 45.2
            }
        ),
        SystemAlert(
            id="alert_006",
            type="security_warning",
            title="Podejrzane połączenie",
            message="Wykryto próbę nieautoryzowanego połączenia z adresu IP 10.0.0.250",
            severity=AlertSeverity.ERROR,
            status=AlertStatus.ACTIVE,
            source="security_monitor",
            source_type="system",
            source_name="Security Monitor",
            category="security",
            timestamp=now - timedelta(minutes=1),
            metadata={
                "source_ip": "10.0.0.250",
                "attempted_protocol": "modbus-tcp",
                "blocked": True,
                "attempt_count": 3
            }
        )
    ]
    
    return sample_alerts

@router.get("/alerts", response_model=List[SystemAlert])
async def get_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    resolved: Optional[bool] = None,
    limit: int = Query(50, description="Max alerts to return"),
    offset: int = Query(0, description="Offset for pagination")
):
    """Get system alerts with filtering"""
    try:
        # Initialize sample data if empty
        if not alerts_storage:
            sample_alerts = create_sample_alerts()
            for alert in sample_alerts:
                alerts_storage[alert.id] = alert
            logger.info(f"Initialized {len(sample_alerts)} sample alerts")
        
        # Filter alerts
        filtered_alerts = list(alerts_storage.values())
        
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a.severity.value == severity]
        if status:
            filtered_alerts = [a for a in filtered_alerts if a.status.value == status]
        if source:
            filtered_alerts = [a for a in filtered_alerts if a.source == source]
        if category:
            filtered_alerts = [a for a in filtered_alerts if a.category == category]
        if acknowledged is not None:
            filtered_alerts = [a for a in filtered_alerts if a.acknowledged == acknowledged]
        if resolved is not None:
            filtered_alerts = [a for a in filtered_alerts if a.resolved == resolved]
        
        # Sort by timestamp desc and apply pagination
        filtered_alerts.sort(key=lambda x: x.timestamp, reverse=True)
        return filtered_alerts[offset:offset + limit]
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts/{alert_id}", response_model=SystemAlert)
async def get_alert(alert_id: str):
    """Get specific alert by ID"""
    try:
        if alert_id in alerts_storage:
            return alerts_storage[alert_id]
        
        raise HTTPException(status_code=404, detail="Alert not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts", response_model=SystemAlert)
async def create_alert(alert_data: AlertCreateRequest):
    """Create new system alert"""
    try:
        alert = SystemAlert(
            id=f"alert_{int(datetime.utcnow().timestamp())}_{abs(hash(alert_data.title)) % 1000}",
            timestamp=datetime.utcnow(),
            **alert_data.dict()
        )
        
        alerts_storage[alert.id] = alert
        logger.info(f"Created alert: {alert.title}")
        
        # Broadcast alert via WebSocket if available
        try:
            await broadcast_new_alert(alert)
        except Exception as e:
            logger.warning(f"Could not broadcast alert: {e}")
        
        return alert
        
    except Exception as e:
        logger.error(f"Failed to create alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, ack_data: AlertAcknowledgeRequest):
    """Acknowledge an alert"""
    try:
        if alert_id not in alerts_storage:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert = alerts_storage[alert_id]
        alert.acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = ack_data.acknowledged_by
        alert.status = AlertStatus.ACKNOWLEDGED
        
        if ack_data.notes:
            alert.metadata["acknowledgment_notes"] = ack_data.notes
        
        alerts_storage[alert_id] = alert
        logger.info(f"Acknowledged alert {alert_id} by {ack_data.acknowledged_by}")
        
        return {
            "success": True,
            "message": "Alert acknowledged successfully",
            "alert": alert
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, resolve_data: AlertResolveRequest):
    """Resolve an alert"""
    try:
        if alert_id not in alerts_storage:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert = alerts_storage[alert_id]
        alert.resolved = True
        alert.resolved_at = datetime.utcnow()
        alert.resolved_by = resolve_data.resolved_by
        alert.status = AlertStatus.RESOLVED
        
        # Also mark as acknowledged
        if not alert.acknowledged:
            alert.acknowledged = True
            alert.acknowledged_at = datetime.utcnow()
            alert.acknowledged_by = resolve_data.resolved_by
        
        if resolve_data.resolution_notes:
            alert.metadata["resolution_notes"] = resolve_data.resolution_notes
        
        alerts_storage[alert_id] = alert
        logger.info(f"Resolved alert {alert_id} by {resolve_data.resolved_by}")
        
        return {
            "success": True,
            "message": "Alert resolved successfully",
            "alert": alert
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/mute")
async def mute_alert(alert_id: str, duration_hours: int = Query(24, description="Mute duration in hours")):
    """Mute an alert for specified duration"""
    try:
        if alert_id not in alerts_storage:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert = alerts_storage[alert_id]
        alert.status = AlertStatus.MUTED
        alert.muted_until = datetime.utcnow() + timedelta(hours=duration_hours)
        
        alerts_storage[alert_id] = alert
        logger.info(f"Muted alert {alert_id} for {duration_hours} hours")
        
        return {
            "success": True,
            "message": f"Alert muted for {duration_hours} hours",
            "muted_until": alert.muted_until.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mute alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert"""
    try:
        if alert_id not in alerts_storage:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        deleted_alert = alerts_storage[alert_id]
        del alerts_storage[alert_id]
        logger.info(f"Deleted alert {alert_id}: {deleted_alert.title}")
        
        return {
            "success": True,
            "message": "Alert deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/bulk-acknowledge")
async def bulk_acknowledge_alerts(alert_ids: List[str], acknowledged_by: str = "admin"):
    """Acknowledge multiple alerts at once"""
    try:
        acknowledged_count = 0
        
        for alert_id in alert_ids:
            if alert_id in alerts_storage:
                alert = alerts_storage[alert_id]
                if not alert.acknowledged:
                    alert.acknowledged = True
                    alert.acknowledged_at = datetime.utcnow()
                    alert.acknowledged_by = acknowledged_by
                    alert.status = AlertStatus.ACKNOWLEDGED
                    acknowledged_count += 1
        
        logger.info(f"Bulk acknowledged {acknowledged_count} alerts by {acknowledged_by}")
        
        return {
            "success": True,
            "message": f"Acknowledged {acknowledged_count} alerts",
            "acknowledged_count": acknowledged_count
        }
        
    except Exception as e:
        logger.error(f"Failed to bulk acknowledge alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts/stats")
async def get_alert_stats():
    """Get alert statistics"""
    try:
        # Initialize sample data if empty
        if not alerts_storage:
            sample_alerts = create_sample_alerts()
            for alert in sample_alerts:
                alerts_storage[alert.id] = alert
        
        all_alerts = list(alerts_storage.values())
        now = datetime.utcnow()
        last_hour = now - timedelta(hours=1)
        last_24h = now - timedelta(hours=24)
        
        stats = {
            "total": len(all_alerts),
            "active": len([a for a in all_alerts if a.status == AlertStatus.ACTIVE]),
            "acknowledged": len([a for a in all_alerts if a.status == AlertStatus.ACKNOWLEDGED]),
            "resolved": len([a for a in all_alerts if a.status == AlertStatus.RESOLVED]),
            "muted": len([a for a in all_alerts if a.status == AlertStatus.MUTED]),
            "last_hour": len([a for a in all_alerts if a.timestamp > last_hour]),
            "last_24h": len([a for a in all_alerts if a.timestamp > last_24h]),
            "by_severity": {
                "critical": len([a for a in all_alerts if a.severity == AlertSeverity.CRITICAL]),
                "error": len([a for a in all_alerts if a.severity == AlertSeverity.ERROR]),
                "warning": len([a for a in all_alerts if a.severity == AlertSeverity.WARNING]),
                "info": len([a for a in all_alerts if a.severity == AlertSeverity.INFO])
            },
            "by_source_type": {
                "device": len([a for a in all_alerts if a.source_type == "device"]),
                "protocol": len([a for a in all_alerts if a.source_type == "protocol"]),
                "system": len([a for a in all_alerts if a.source_type == "system"])
            },
            "by_category": {}
        }
        
        # Count by category
        categories = {}
        for alert in all_alerts:
            cat = alert.category
            categories[cat] = categories.get(cat, 0) + 1
        stats["by_category"] = categories
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get alert stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper function to broadcast new alerts
async def broadcast_new_alert(alert: SystemAlert):
    """Broadcast new alert via WebSocket"""
    try:
        # Import websocket_manager here to avoid circular imports
        from .websocket import websocket_manager
        
        message = {
            "type": "new_alert",
            "data": alert.dict()
        }
        
        await websocket_manager.broadcast(message, "alerts")
        logger.info(f"Broadcast new alert: {alert.title}")
        
    except ImportError:
        logger.warning("WebSocket manager not available for alert broadcast")
    except Exception as e:
        logger.error(f"Failed to broadcast alert: {e}")

# Background task to generate demo alerts
async def start_demo_alert_generator():
    """Generate demo alerts for testing"""
    await asyncio.sleep(10)  # Wait for system startup
    
    while True:
        try:
            await asyncio.sleep(120)  # Every 2 minutes
            
            # Don't spam too many alerts
            if len(alerts_storage) > 15:
                continue
            
            # Generate random demo alerts
            demo_alerts = [
                ("device_status", "Kontrola urządzenia", "Rutynowa kontrola urządzenia zakończona pomyślnie", AlertSeverity.INFO, "device_monitor"),
                ("performance", "Zużycie CPU", f"Zużycie CPU: {25 + (datetime.utcnow().minute % 30)}%", AlertSeverity.INFO, "system_monitor"),
                ("connection", "Połączenia stabilne", "Wszystkie połączenia protokołów są stabilne", AlertSeverity.INFO, "protocol_manager")
            ]
            
            alert_type, title, message, severity, source = demo_alerts[datetime.utcnow().minute % 3]
            
            new_alert = SystemAlert(
                id=f"alert_demo_{int(datetime.utcnow().timestamp())}_{abs(hash(title)) % 1000}",
                type=alert_type,
                title=title,
                message=message,
                severity=severity,
                source=source,
                source_type="system",
                source_name="Demo System",
                category="demo",
                timestamp=datetime.utcnow(),
                metadata={"auto_generated": True, "demo": True}
            )
            
            alerts_storage[new_alert.id] = new_alert
            await broadcast_new_alert(new_alert)
            
        except Exception as e:
            logger.error(f"Error in demo alert generator: {e}")
            await asyncio.sleep(60)  # Wait before retry

# Start demo alert generator
asyncio.create_task(start_demo_alert_generator())