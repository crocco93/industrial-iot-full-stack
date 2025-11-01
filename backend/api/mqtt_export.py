from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import logging
import asyncio
import json
from .auth import require_auth, UserModel, check_permission

router = APIRouter()
logger = logging.getLogger(__name__)

class MQTTExportConfig(BaseModel):
    id: Optional[str] = None
    name: str = Field(description="Export configuration name")
    description: Optional[str] = Field(default="", description="Configuration description")
    enabled: bool = Field(default=True, description="Whether export is active")
    broker_url: str = Field(description="MQTT broker URL (e.g., mqtt://localhost:1883)")
    username: Optional[str] = Field(default=None, description="MQTT username")
    password: Optional[str] = Field(default=None, description="MQTT password")
    topic_prefix: str = Field(default="industrial-iot", description="Topic prefix")
    qos: int = Field(default=0, description="MQTT QoS level (0, 1, 2)")
    retain: bool = Field(default=False, description="Retain messages")
    publish_interval: int = Field(default=5, description="Publish interval in seconds")
    data_points: List[str] = Field(default=[], description="Data point IDs to export")
    filters: Dict[str, Any] = Field(default={}, description="Data filters")
    format: str = Field(default="json", description="Message format: json, csv, influx")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_export: Optional[datetime] = None
    export_count: int = Field(default=0, description="Number of messages exported")
    status: str = Field(default="inactive", description="Export status: active, inactive, error")

class MQTTExportCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    broker_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    topic_prefix: str = "industrial-iot"
    qos: int = 0
    retain: bool = False
    publish_interval: int = 5
    data_points: List[str] = []
    filters: Dict[str, Any] = {}
    format: str = "json"

class MQTTExportUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    broker_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    topic_prefix: Optional[str] = None
    qos: Optional[int] = None
    retain: Optional[bool] = None
    publish_interval: Optional[int] = None
    data_points: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None
    format: Optional[str] = None

class MQTTTestRequest(BaseModel):
    broker_url: str
    username: Optional[str] = None
    password: Optional[str] = None
    topic: str = "industrial-iot/test"
    message: str = "Test message from Industrial IoT System"
    qos: int = 0

# In-memory storage for MQTT export configurations
mqtt_exports_storage: Dict[str, MQTTExportConfig] = {}

def create_sample_mqtt_exports() -> List[MQTTExportConfig]:
    """Create sample MQTT export configurations"""
    now = datetime.utcnow()
    
    configs = [
        MQTTExportConfig(
            id="mqtt_export_001",
            name="Production Data Export",
            description="Export temperature and pressure data from production floor",
            enabled=True,
            broker_url="mqtt://192.168.1.200:1883",
            username="industrial_user",
            topic_prefix="factory/production",
            qos=1,
            retain=True,
            publish_interval=10,
            data_points=["dp_001", "dp_002"],  # Temperature and Pressure
            filters={
                "location": "area_production_001",
                "quality_threshold": 0.8
            },
            format="json",
            created_at=now,
            updated_at=now,
            status="active",
            export_count=1250,
            last_export=now - timedelta(seconds=10)
        ),
        MQTTExportConfig(
            id="mqtt_export_002",
            name="SCADA Integration",
            description="Export all device data to main SCADA system",
            enabled=False,
            broker_url="mqtt://scada.factory.local:1883",
            username="scada_gateway",
            topic_prefix="scada/devices",
            qos=2,
            retain=False,
            publish_interval=5,
            data_points=["dp_001", "dp_002", "dp_003", "dp_004"],
            filters={
                "status": "active",
                "exclude_test_data": True
            },
            format="influx",
            created_at=now - timedelta(hours=2),
            updated_at=now - timedelta(minutes=30),
            status="inactive",
            export_count=850
        ),
        MQTTExportConfig(
            id="mqtt_export_003",
            name="Cloud Analytics",
            description="Export aggregated data to cloud analytics platform",
            enabled=True,
            broker_url="mqtts://cloud-broker.analytics.com:8883",
            username="analytics_client",
            topic_prefix="analytics/industrial",
            qos=1,
            retain=False,
            publish_interval=60,  # Every minute
            data_points=["dp_003", "dp_005"],  # Flow and Power
            filters={
                "aggregation": "average_1min",
                "exclude_outliers": True
            },
            format="json",
            created_at=now - timedelta(days=1),
            updated_at=now - timedelta(hours=6),
            status="active",
            export_count=2876,
            last_export=now - timedelta(seconds=45)
        )
    ]
    
    return configs

@router.get("/mqtt-exports", response_model=List[MQTTExportConfig])
async def get_mqtt_exports(
    enabled: Optional[bool] = None,
    status: Optional[str] = None,
    current_user: UserModel = Depends(require_auth)
):
    """Get MQTT export configurations"""
    try:
        # Check read permission
        if not check_permission(current_user, "read_protocols"):
            raise HTTPException(
                status_code=403,
                detail="Permission denied: read_protocols required"
            )
        
        # Initialize sample data if empty
        if not mqtt_exports_storage:
            sample_configs = create_sample_mqtt_exports()
            for config in sample_configs:
                mqtt_exports_storage[config.id] = config
            logger.info(f"Initialized {len(sample_configs)} sample MQTT export configs")
        
        # Filter configurations
        filtered_exports = list(mqtt_exports_storage.values())
        
        if enabled is not None:
            filtered_exports = [e for e in filtered_exports if e.enabled == enabled]
        if status:
            filtered_exports = [e for e in filtered_exports if e.status == status]
        
        # Sort by creation date
        filtered_exports.sort(key=lambda x: x.created_at, reverse=True)
        
        # Hide passwords from response
        for export in filtered_exports:
            if export.password:
                export.password = "***hidden***"
        
        return filtered_exports
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get MQTT exports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mqtt-exports/{export_id}", response_model=MQTTExportConfig)
async def get_mqtt_export(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Get specific MQTT export configuration"""
    try:
        if not check_permission(current_user, "read_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        
        # Hide password
        if export_config.password:
            export_config.password = "***hidden***"
        
        return export_config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mqtt-exports", response_model=MQTTExportConfig)
async def create_mqtt_export(export_data: MQTTExportCreateRequest, current_user: UserModel = Depends(require_auth)):
    """Create new MQTT export configuration"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied: write_protocols required")
        
        export_config = MQTTExportConfig(
            id=f"mqtt_export_{int(datetime.utcnow().timestamp())}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **export_data.dict()
        )
        
        mqtt_exports_storage[export_config.id] = export_config
        logger.info(f"Created MQTT export config {export_config.name} by {current_user.username}")
        
        return export_config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create MQTT export: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/mqtt-exports/{export_id}", response_model=MQTTExportConfig)
async def update_mqtt_export(export_id: str, update_data: MQTTExportUpdateRequest, current_user: UserModel = Depends(require_auth)):
    """Update MQTT export configuration"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        update_dict = update_data.dict(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        for key, value in update_dict.items():
            setattr(export_config, key, value)
        
        mqtt_exports_storage[export_id] = export_config
        logger.info(f"Updated MQTT export config {export_id} by {current_user.username}")
        
        return export_config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/mqtt-exports/{export_id}")
async def delete_mqtt_export(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Delete MQTT export configuration"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        config_name = mqtt_exports_storage[export_id].name
        del mqtt_exports_storage[export_id]
        
        logger.info(f"Deleted MQTT export config {export_id} ({config_name}) by {current_user.username}")
        
        return {
            "success": True,
            "message": "MQTT export configuration deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mqtt-exports/{export_id}/start")
async def start_mqtt_export(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Start MQTT export"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        export_config.enabled = True
        export_config.status = "active"
        export_config.updated_at = datetime.utcnow()
        
        # In a real implementation, this would start the MQTT client
        logger.info(f"Started MQTT export {export_id} to {export_config.broker_url}")
        
        return {
            "success": True,
            "message": "MQTT export started successfully",
            "config": export_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mqtt-exports/{export_id}/stop")
async def stop_mqtt_export(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Stop MQTT export"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        export_config.enabled = False
        export_config.status = "inactive"
        export_config.updated_at = datetime.utcnow()
        
        logger.info(f"Stopped MQTT export {export_id}")
        
        return {
            "success": True,
            "message": "MQTT export stopped successfully",
            "config": export_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mqtt-exports/test-connection")
async def test_mqtt_connection(test_data: MQTTTestRequest, current_user: UserModel = Depends(require_auth)):
    """Test MQTT broker connection"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # In a real implementation, this would test the actual MQTT connection
        # For now, simulate the test
        
        logger.info(f"Testing MQTT connection to {test_data.broker_url}")
        
        # Simulate connection test
        await asyncio.sleep(1)
        
        # Mock successful test
        success = not test_data.broker_url.endswith(":9999")  # Fail if port 9999 (for demo)
        
        if success:
            return {
                "success": True,
                "message": "MQTT connection test successful",
                "broker_info": {
                    "url": test_data.broker_url,
                    "connected_at": datetime.utcnow().isoformat(),
                    "ping_ms": 25,
                    "protocol_version": "3.1.1"
                }
            }
        else:
            return {
                "success": False,
                "message": "MQTT connection test failed: Connection refused",
                "error_code": "CONNECTION_REFUSED"
            }
        
    except Exception as e:
        logger.error(f"MQTT connection test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mqtt-exports/{export_id}/status")
async def get_mqtt_export_status(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Get MQTT export status and statistics"""
    try:
        if not check_permission(current_user, "read_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        
        # Calculate statistics
        now = datetime.utcnow()
        uptime_seconds = 0
        if export_config.status == "active" and export_config.last_export:
            uptime_seconds = int((now - export_config.created_at).total_seconds())
        
        messages_per_minute = 0
        if export_config.publish_interval > 0:
            messages_per_minute = 60 / export_config.publish_interval
        
        status_info = {
            "config_id": export_id,
            "name": export_config.name,
            "status": export_config.status,
            "enabled": export_config.enabled,
            "broker_url": export_config.broker_url,
            "topic_prefix": export_config.topic_prefix,
            "publish_interval": export_config.publish_interval,
            "data_points_count": len(export_config.data_points),
            "total_exports": export_config.export_count,
            "last_export": export_config.last_export.isoformat() if export_config.last_export else None,
            "uptime_seconds": uptime_seconds,
            "estimated_messages_per_minute": messages_per_minute,
            "format": export_config.format,
            "qos": export_config.qos,
            "retain": export_config.retain
        }
        
        return status_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get MQTT export status {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mqtt-exports/stats")
async def get_mqtt_exports_stats(current_user: UserModel = Depends(require_auth)):
    """Get overall MQTT exports statistics"""
    try:
        if not check_permission(current_user, "read_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Initialize sample data if empty
        if not mqtt_exports_storage:
            sample_configs = create_sample_mqtt_exports()
            for config in sample_configs:
                mqtt_exports_storage[config.id] = config
        
        all_exports = list(mqtt_exports_storage.values())
        
        stats = {
            "total_configs": len(all_exports),
            "active_configs": len([e for e in all_exports if e.status == "active"]),
            "enabled_configs": len([e for e in all_exports if e.enabled]),
            "total_exports_count": sum(e.export_count for e in all_exports),
            "by_status": {},
            "by_format": {},
            "data_points_total": len(set(dp for e in all_exports for dp in e.data_points)),
            "average_publish_interval": 0
        }
        
        # Count by status and format
        for export in all_exports:
            # By status
            status = export.status
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # By format
            format_type = export.format
            stats["by_format"][format_type] = stats["by_format"].get(format_type, 0) + 1
        
        # Calculate average publish interval
        if all_exports:
            stats["average_publish_interval"] = sum(e.publish_interval for e in all_exports) / len(all_exports)
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get MQTT exports stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mqtt-exports/{export_id}/test-export")
async def test_mqtt_export(export_id: str, current_user: UserModel = Depends(require_auth)):
    """Test MQTT export with sample data"""
    try:
        if not check_permission(current_user, "write_protocols"):
            raise HTTPException(status_code=403, detail="Permission denied")
        
        if export_id not in mqtt_exports_storage:
            raise HTTPException(status_code=404, detail="MQTT export configuration not found")
        
        export_config = mqtt_exports_storage[export_id]
        
        # Generate sample export message
        now = datetime.utcnow()
        
        if export_config.format == "json":
            sample_message = {
                "timestamp": now.isoformat(),
                "source": "industrial-iot-gateway",
                "export_config": export_config.name,
                "data_points": [
                    {
                        "id": "dp_001",
                        "name": "Temperature Zone A",
                        "value": 23.5,
                        "unit": "°C",
                        "quality": 1.0
                    },
                    {
                        "id": "dp_002",
                        "name": "Pressure Main Line",
                        "value": 4.2,
                        "unit": "bar",
                        "quality": 1.0
                    }
                ]
            }
        elif export_config.format == "influx":
            sample_message = {
                "measurement": "industrial_data",
                "tags": {
                    "location": "production_floor_a",
                    "config": export_config.name
                },
                "fields": {
                    "temperature": 23.5,
                    "pressure": 4.2
                },
                "timestamp": int(now.timestamp() * 1000000000)  # nanoseconds
            }
        else:  # csv format
            sample_message = "timestamp,data_point_id,name,value,unit,quality\n" + \
                           f"{now.isoformat()},dp_001,Temperature Zone A,23.5,°C,1.0\n" + \
                           f"{now.isoformat()},dp_002,Pressure Main Line,4.2,bar,1.0"
        
        # Simulate publishing
        await asyncio.sleep(0.5)
        
        export_config.last_export = now
        export_config.export_count += 1
        
        logger.info(f"Test export sent for config {export_id}")
        
        return {
            "success": True,
            "message": "Test export completed successfully",
            "topic": f"{export_config.topic_prefix}/test",
            "sample_message": sample_message if isinstance(sample_message, dict) else "<CSV data>",
            "format": export_config.format,
            "qos": export_config.qos,
            "retain": export_config.retain
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test MQTT export {export_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background task to simulate MQTT publishing
async def mqtt_export_worker():
    """Background worker to handle MQTT exports"""
    await asyncio.sleep(30)  # Wait for system startup
    
    while True:
        try:
            await asyncio.sleep(5)  # Check every 5 seconds
            
            active_exports = [e for e in mqtt_exports_storage.values() if e.enabled and e.status == "active"]
            
            for export_config in active_exports:
                now = datetime.utcnow()
                
                # Check if it's time to publish
                if (not export_config.last_export or 
                    (now - export_config.last_export).total_seconds() >= export_config.publish_interval):
                    
                    # Simulate publishing data
                    export_config.last_export = now
                    export_config.export_count += 1
                    
                    logger.debug(f"MQTT export {export_config.name}: published {len(export_config.data_points)} data points")
            
        except Exception as e:
            logger.error(f"Error in MQTT export worker: {e}")
            await asyncio.sleep(30)

# Start MQTT export background worker
asyncio.create_task(mqtt_export_worker())