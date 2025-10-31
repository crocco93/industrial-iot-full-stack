from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime

from models.system_settings import SystemSettings

router = APIRouter()

@router.get("/settings", response_model=List[dict])
async def get_settings():
    """Get all system settings"""
    try:
        settings = await SystemSettings.find_all().to_list()
        
        settings_list = []
        for setting in settings:
            setting_dict = setting.dict()
            setting_dict["id"] = str(setting.id)
            settings_list.append(setting_dict)
        
        return settings_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings/{category}")
async def get_settings_by_category(category: str):
    """Get settings by category"""
    try:
        settings = await SystemSettings.find(SystemSettings.category == category).to_list()
        
        settings_dict = {}
        for setting in settings:
            settings_dict[setting.key] = {
                "value": setting.value,
                "description": setting.description,
                "updated_at": setting.updated_at
            }
        
        return {
            "category": category,
            "settings": settings_dict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/settings/{category}/{key}")
async def get_setting(category: str, key: str):
    """Get specific setting"""
    try:
        setting = await SystemSettings.find_one(
            SystemSettings.category == category,
            SystemSettings.key == key
        )
        
        if not setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        result = setting.dict()
        result["id"] = str(setting.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/settings/{key}")
async def update_setting(key: str, setting_data: dict):
    """Update or create a setting"""
    try:
        category = setting_data.get("category", "general")
        value = setting_data.get("value")
        description = setting_data.get("description")
        
        if value is None:
            raise HTTPException(status_code=400, detail="Value is required")
        
        # Find existing setting
        existing_setting = await SystemSettings.find_one(
            SystemSettings.category == category,
            SystemSettings.key == key
        )
        
        if existing_setting:
            # Update existing
            existing_setting.value = value
            existing_setting.description = description or existing_setting.description
            existing_setting.updated_at = datetime.now()
            await existing_setting.save()
            
            result = existing_setting.dict()
            result["id"] = str(existing_setting.id)
            
            return {"success": True, "data": result}
        else:
            # Create new
            new_setting = SystemSettings(
                category=category,
                key=key,
                value=value,
                description=description
            )
            
            await new_setting.insert()
            
            result = new_setting.dict()
            result["id"] = str(new_setting.id)
            
            return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/settings/{category}/{key}")
async def delete_setting(category: str, key: str):
    """Delete a setting"""
    try:
        setting = await SystemSettings.find_one(
            SystemSettings.category == category,
            SystemSettings.key == key
        )
        
        if not setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        await setting.delete()
        
        return {"success": True, "message": "Setting deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/info")
async def get_system_info():
    """Get system information"""
    try:
        # Get system statistics
        from models.protocol import Protocol
        from models.connection import Connection
        from models.monitoring import MonitoringData
        from models.system_log import SystemLog
        
        protocol_count = await Protocol.count()
        connection_count = await Connection.count()
        active_connections = await Connection.find(Connection.status == "active").count()
        
        # Recent monitoring data count (last hour)
        from datetime import timedelta
        one_hour_ago = datetime.now() - timedelta(hours=1)
        recent_monitoring_count = await MonitoringData.find(
            MonitoringData.timestamp >= one_hour_ago
        ).count()
        
        # Recent log entries (last hour)
        recent_logs_count = await SystemLog.find(
            SystemLog.timestamp >= one_hour_ago
        ).count()
        
        return {
            "system": {
                "name": "Industrial Protocols Management System",
                "version": "1.0.0",
                "uptime": "Running",  # In a real system, calculate actual uptime
                "status": "healthy"
            },
            "statistics": {
                "total_protocols": protocol_count,
                "total_connections": connection_count,
                "active_connections": active_connections,
                "monitoring_data_points_last_hour": recent_monitoring_count,
                "log_entries_last_hour": recent_logs_count
            },
            "timestamp": datetime.now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))