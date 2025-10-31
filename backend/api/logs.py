from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta

from models.system_log import SystemLog, LogLevel

router = APIRouter()

@router.get("/logs", response_model=dict)
async def get_logs(
    level: Optional[str] = Query(None, description="Filter by log level"),
    source: Optional[str] = Query(None, description="Filter by source"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page"),
    hours: int = Query(24, description="Hours of logs to retrieve")
):
    """Get system logs with pagination and filtering"""
    try:
        # Calculate time range
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # Build query
        query = SystemLog.timestamp >= start_time
        
        if level:
            query = query & (SystemLog.level == level)
        if source:
            query = query & (SystemLog.source == source)
        
        # Get total count
        total = await SystemLog.find(query).count()
        
        # Get paginated results
        skip = (page - 1) * limit
        logs = await SystemLog.find(query).sort(-SystemLog.timestamp).skip(skip).limit(limit).to_list()
        
        # Format results
        log_list = []
        for log in logs:
            log_dict = log.dict()
            log_dict["id"] = str(log.id)
            log_list.append(log_dict)
        
        return {
            "success": True,
            "data": log_list,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/system")
async def get_system_logs(
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page")
):
    """Get system-specific logs"""
    try:
        return await get_logs(source="system", page=page, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/protocols")
async def get_protocol_logs(
    protocol_id: Optional[str] = Query(None, description="Filter by protocol ID"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(50, description="Items per page")
):
    """Get protocol-specific logs"""
    try:
        source_filter = f"protocol.{protocol_id}" if protocol_id else "protocol"
        return await get_logs(source=source_filter, page=page, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logs")
async def create_log(log_data: dict):
    """Create a new log entry"""
    try:
        log = SystemLog(
            level=log_data.get("level", LogLevel.INFO),
            source=log_data.get("source", "system"),
            message=log_data.get("message", ""),
            metadata=log_data.get("metadata", {})
        )
        
        await log.insert()
        
        result = log.dict()
        result["id"] = str(log.id)
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/logs")
async def clear_logs(
    level: Optional[str] = Query(None, description="Clear logs of specific level"),
    source: Optional[str] = Query(None, description="Clear logs from specific source"),
    days: int = Query(30, description="Clear logs older than N days")
):
    """Clear old logs"""
    try:
        # Calculate cutoff date
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Build query
        query = SystemLog.timestamp < cutoff_date
        
        if level:
            query = query & (SystemLog.level == level)
        if source:
            query = query & (SystemLog.source == source)
        
        # Count logs to be deleted
        count = await SystemLog.find(query).count()
        
        # Delete logs
        await SystemLog.find(query).delete()
        
        return {
            "success": True,
            "message": f"Deleted {count} log entries older than {days} days"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))