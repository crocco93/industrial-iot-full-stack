from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from enum import Enum
from models.monitoring import MonitoringData
from models.device import Device
from models.data_point import DataPoint
from database.mongodb import get_database

router = APIRouter()

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high" 
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    MUTED = "muted"

class AlertModel(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    severity: AlertSeverity
    status: AlertStatus = AlertStatus.ACTIVE
    source: str  # device_id, protocol_id, system
    source_type: str  # device, protocol, system, data_point
    source_name: str
    category: str  # connection, threshold, system, security
    data_point_id: Optional[str] = None
    device_id: Optional[str] = None
    protocol_id: Optional[str] = None
    threshold_value: Optional[float] = None
    current_value: Optional[float] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    muted_until: Optional[datetime] = None
    notification_sent: bool = False

class AlertCreateRequest(BaseModel):
    title: str
    description: str
    severity: AlertSeverity
    source: str
    source_type: str
    source_name: str
    category: str
    data_point_id: Optional[str] = None
    device_id: Optional[str] = None
    protocol_id: Optional[str] = None
    threshold_value: Optional[float] = None
    current_value: Optional[float] = None
    metadata: Dict[str, Any] = {}

class AlertUpdateRequest(BaseModel):
    status: Optional[AlertStatus] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    mute_duration_hours: Optional[int] = None

# In-memory storage for alerts (in production, this would be MongoDB)
alerts_storage: Dict[str, AlertModel] = {}

@router.get("/alerts", response_model=List[AlertModel])
async def get_alerts(
    severity: Optional[AlertSeverity] = None,
    status: Optional[AlertStatus] = None,
    category: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    include_resolved: bool = Query(False),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Get alerts with filtering options"""
    try:
        # Try to load from database first
        db = get_database()
        alerts_collection = db.alerts
        
        # Build query
        query = {}
        
        if severity:
            query["severity"] = severity
        if status:
            query["status"] = status
        if category:
            query["category"] = category
        if source_type:
            query["source_type"] = source_type
        
        if not include_resolved:
            query["status"] = {"$ne": "resolved"}
        
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = start_date
            if end_date:
                date_query["$lte"] = end_date
            query["created_at"] = date_query
        
        alerts_cursor = alerts_collection.find(query).sort("created_at", -1).limit(limit)
        alerts = await alerts_cursor.to_list(length=limit)
        
        # Convert MongoDB documents to response format
        result = []
        for alert in alerts:
            alert["id"] = alert.get("_id", alert.get("id"))
            if "_id" in alert:
                del alert["_id"]
            result.append(alert)
        
        # If no alerts in DB, create some sample alerts for development
        if not result:
            sample_alerts = await create_sample_alerts()
            result = sample_alerts
        
        return result
        
    except Exception as e:
        # Fallback to in-memory storage
        print(f"Database query failed, using in-memory: {e}")
        
        if not alerts_storage:
            sample_alerts = await create_sample_alerts()
            for alert in sample_alerts:
                alerts_storage[alert.id] = alert
        
        # Apply filters
        filtered_alerts = list(alerts_storage.values())
        
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a.severity == severity]
        if status:
            filtered_alerts = [a for a in filtered_alerts if a.status == status]
        if category:
            filtered_alerts = [a for a in filtered_alerts if a.category == category]
        if source_type:
            filtered_alerts = [a for a in filtered_alerts if a.source_type == source_type]
        if not include_resolved:
            filtered_alerts = [a for a in filtered_alerts if a.status != AlertStatus.RESOLVED]
        
        # Sort by creation date (newest first)
        filtered_alerts.sort(key=lambda x: x.created_at, reverse=True)
        
        return filtered_alerts[:limit]

async def create_sample_alerts() -> List[AlertModel]:
    """Create sample alerts for development purposes"""
    now = datetime.utcnow()
    
    return [
        AlertModel(
            id="alert_001",
            title="High Temperature Warning",
            description="Temperature sensor reading above threshold (28°C > 25°C)",
            severity=AlertSeverity.HIGH,
            status=AlertStatus.ACTIVE,
            source="device_001",
            source_type="device",
            source_name="Temperature Sensor #1",
            category="threshold",
            device_id="device_001",
            data_point_id="dp_temp_001",
            threshold_value=25.0,
            current_value=28.2,
            created_at=now - timedelta(minutes=5),
            updated_at=now - timedelta(minutes=5),
            metadata={"location": "Production Floor A"}
        ),
        AlertModel(
            id="alert_002",
            title="Connection Lost",
            description="Modbus TCP connection to PLC lost",
            severity=AlertSeverity.CRITICAL,
            status=AlertStatus.ACTIVE,
            source="protocol_modbus_001",
            source_type="protocol",
            source_name="Modbus TCP #1",
            category="connection",
            protocol_id="protocol_modbus_001",
            created_at=now - timedelta(minutes=15),
            updated_at=now - timedelta(minutes=15),
            metadata={"last_seen": (now - timedelta(minutes=15)).isoformat()}
        ),
        AlertModel(
            id="alert_003",
            title="High CPU Usage",
            description="System CPU usage above 85%",
            severity=AlertSeverity.MEDIUM,
            status=AlertStatus.ACKNOWLEDGED,
            source="system",
            source_type="system",
            source_name="Industrial IoT System",
            category="system",
            current_value=87.5,
            threshold_value=85.0,
            created_at=now - timedelta(hours=1),
            updated_at=now - timedelta(minutes=30),
            acknowledged_at=now - timedelta(minutes=30),
            acknowledged_by="admin",
            metadata={"component": "backend_api"}
        )
    ]

@router.get("/alerts/{alert_id}", response_model=AlertModel)
async def get_alert(alert_id: str):
    """Get specific alert by ID"""
    try:
        db = get_database()
        alert = await db.alerts.find_one({"_id": alert_id})
        
        if not alert:
            if alert_id in alerts_storage:
                return alerts_storage[alert_id]
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert["id"] = alert["_id"]
        del alert["_id"]
        return alert
        
    except HTTPException:
        raise
    except Exception as e:
        if alert_id in alerts_storage:
            return alerts_storage[alert_id]
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts", response_model=AlertModel)
async def create_alert(alert_data: AlertCreateRequest):
    """Create new alert"""
    try:
        alert = AlertModel(
            id=f"alert_{int(datetime.utcnow().timestamp())}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **alert_data.dict()
        )
        
        # Try to save to database
        try:
            db = get_database()
            alert_dict = alert.dict()
            alert_dict["_id"] = alert_dict["id"]
            await db.alerts.insert_one(alert_dict)
        except Exception as e:
            print(f"Database save failed, using in-memory: {e}")
            alerts_storage[alert.id] = alert
        
        return alert
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, acknowledged_by: str):
    """Acknowledge an alert"""
    try:
        # Try database first
        db = get_database()
        
        update_data = {
            "status": AlertStatus.ACKNOWLEDGED,
            "acknowledged_at": datetime.utcnow(),
            "acknowledged_by": acknowledged_by,
            "updated_at": datetime.utcnow()
        }
        
        result = await db.alerts.update_one(
            {"_id": alert_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            # Check in-memory storage
            if alert_id in alerts_storage:
                alert = alerts_storage[alert_id]
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.utcnow()
                alert.acknowledged_by = acknowledged_by
                alert.updated_at = datetime.utcnow()
                return {"success": True, "message": "Alert acknowledged"}
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return {"success": True, "message": "Alert acknowledged"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, resolved_by: str):
    """Resolve an alert"""
    try:
        db = get_database()
        
        update_data = {
            "status": AlertStatus.RESOLVED,
            "resolved_at": datetime.utcnow(),
            "resolved_by": resolved_by,
            "updated_at": datetime.utcnow()
        }
        
        result = await db.alerts.update_one(
            {"_id": alert_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            if alert_id in alerts_storage:
                alert = alerts_storage[alert_id]
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.utcnow()
                alert.resolved_by = resolved_by
                alert.updated_at = datetime.utcnow()
                return {"success": True, "message": "Alert resolved"}
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return {"success": True, "message": "Alert resolved"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}/mute")
async def mute_alert(alert_id: str, duration_hours: int = 24):
    """Mute an alert for specified duration"""
    try:
        mute_until = datetime.utcnow() + timedelta(hours=duration_hours)
        
        db = get_database()
        
        update_data = {
            "status": AlertStatus.MUTED,
            "muted_until": mute_until,
            "updated_at": datetime.utcnow()
        }
        
        result = await db.alerts.update_one(
            {"_id": alert_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            if alert_id in alerts_storage:
                alert = alerts_storage[alert_id]
                alert.status = AlertStatus.MUTED
                alert.muted_until = mute_until
                alert.updated_at = datetime.utcnow()
                return {"success": True, "message": f"Alert muted for {duration_hours} hours"}
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return {"success": True, "message": f"Alert muted for {duration_hours} hours"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts/stats")
async def get_alert_stats():
    """Get alert statistics"""
    try:
        db = get_database()
        
        # Aggregate statistics
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "status": "$status",
                        "severity": "$severity"
                    },
                    "count": {"$sum": 1}
                }
            }
        ]
        
        stats_cursor = db.alerts.aggregate(pipeline)
        stats_data = await stats_cursor.to_list(length=100)
        
        # Process statistics
        stats = {
            "total": 0,
            "active": 0,
            "acknowledged": 0,
            "resolved": 0,
            "muted": 0,
            "by_severity": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "info": 0
            }
        }
        
        for stat in stats_data:
            status = stat["_id"]["status"]
            severity = stat["_id"]["severity"]
            count = stat["count"]
            
            stats["total"] += count
            
            if status in stats:
                stats[status] += count
            
            if severity in stats["by_severity"]:
                stats["by_severity"][severity] += count
        
        # If no data, use in-memory stats
        if stats["total"] == 0 and alerts_storage:
            for alert in alerts_storage.values():
                stats["total"] += 1
                stats[alert.status.value] += 1
                stats["by_severity"][alert.severity.value] += 1
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/bulk-acknowledge")
async def bulk_acknowledge_alerts(
    alert_ids: List[str],
    acknowledged_by: str
):
    """Acknowledge multiple alerts at once"""
    try:
        db = get_database()
        
        update_data = {
            "status": AlertStatus.ACKNOWLEDGED,
            "acknowledged_at": datetime.utcnow(),
            "acknowledged_by": acknowledged_by,
            "updated_at": datetime.utcnow()
        }
        
        result = await db.alerts.update_many(
            {"_id": {"$in": alert_ids}},
            {"$set": update_data}
        )
        
        # Also update in-memory
        for alert_id in alert_ids:
            if alert_id in alerts_storage:
                alert = alerts_storage[alert_id]
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.utcnow()
                alert.acknowledged_by = acknowledged_by
                alert.updated_at = datetime.utcnow()
        
        return {
            "success": True,
            "message": f"Acknowledged {result.modified_count} alerts",
            "modified_count": result.modified_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete an alert"""
    try:
        db = get_database()
        result = await db.alerts.delete_one({"_id": alert_id})
        
        if result.deleted_count == 0:
            if alert_id in alerts_storage:
                del alerts_storage[alert_id]
                return {"success": True, "message": "Alert deleted"}
            raise HTTPException(status_code=404, detail="Alert not found")
        
        # Also remove from in-memory
        if alert_id in alerts_storage:
            del alerts_storage[alert_id]
        
        return {"success": True, "message": "Alert deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/test-notification")
async def test_alert_notification(webhook_url: str, message: str = "Test alert from Industrial IoT System"):
    """Test alert notification to webhook"""
    try:
        import httpx
        
        payload = {
            "text": message,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "Industrial IoT Alert System",
            "severity": "info",
            "test": True
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                timeout=10.0
            )
            
        if response.status_code == 200:
            return {"success": True, "message": "Test notification sent successfully"}
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Webhook responded with status {response.status_code}"
            )
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Webhook request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")