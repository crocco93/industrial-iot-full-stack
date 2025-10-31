from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models.device import Device, DeviceStatus, DeviceType, DeviceCategory
from models.protocol import Protocol
from models.connection import Connection
from models.data_point import DataPoint
from pydantic import BaseModel

router = APIRouter()

class DeviceCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    device_type: DeviceType = DeviceType.PRODUCTION
    category: Optional[DeviceCategory] = None
    protocol_id: Optional[str] = None
    connection_id: Optional[str] = None
    location_id: Optional[str] = None
    area_id: Optional[str] = None
    address: Optional[str] = None
    port: Optional[int] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    configuration: Dict[str, Any] = {}
    read_frequency: int = 1000
    tags: List[str] = []

class DeviceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    device_type: Optional[DeviceType] = None
    category: Optional[DeviceCategory] = None
    protocol_id: Optional[str] = None
    connection_id: Optional[str] = None
    location_id: Optional[str] = None
    area_id: Optional[str] = None
    address: Optional[str] = None
    port: Optional[int] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    status: Optional[DeviceStatus] = None
    configuration: Optional[Dict[str, Any]] = None
    read_frequency: Optional[int] = None
    tags: Optional[List[str]] = None

@router.get("/devices", response_model=List[dict])
async def get_devices(
    location_id: Optional[str] = Query(None),
    area_id: Optional[str] = Query(None),
    device_type: Optional[DeviceType] = Query(None),
    status: Optional[DeviceStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get list of devices with filtering"""
    try:
        query = {}
        if location_id:
            query["location_id"] = location_id
        if area_id:
            query["area_id"] = area_id
        if device_type:
            query["device_type"] = device_type
        if status:
            query["status"] = status
        
        devices = await Device.find(query).skip(skip).limit(limit).to_list()
        device_list = []
        
        for device in devices:
            # Get related data
            protocol = await Protocol.get(device.protocol_id) if device.protocol_id else None
            connection = await Connection.get(device.connection_id) if device.connection_id else None
            data_points_count = await DataPoint.find({"device_id": str(device.id)}).count()
            
            device_dict = device.dict()
            device_dict["id"] = str(device.id)
            device_dict["protocol"] = {
                "id": str(protocol.id),
                "name": protocol.name,
                "type": protocol.type
            } if protocol else None
            device_dict["connection"] = {
                "id": str(connection.id),
                "status": connection.status,
                "address": connection.address
            } if connection else None
            device_dict["data_points_count"] = data_points_count
            device_dict["availability"] = device.calculate_availability()
            device_dict["is_healthy"] = device.is_healthy()
            
            device_list.append(device_dict)
        
        return device_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}")
async def get_device(device_id: str):
    """Get device by ID with full details"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Get related data
        protocol = await Protocol.get(device.protocol_id) if device.protocol_id else None
        connection = await Connection.get(device.connection_id) if device.connection_id else None
        data_points = await DataPoint.find({"device_id": device_id}).to_list()
        
        result = device.dict()
        result["id"] = str(device.id)
        result["protocol"] = protocol.dict() if protocol else None
        result["connection"] = connection.dict() if connection else None
        result["data_points"] = [{
            "id": str(dp.id),
            "name": dp.name,
            "address": dp.address,
            "data_type": dp.data_type,
            "value": dp.current_value,
            "unit": dp.unit,
            "last_read": dp.last_read
        } for dp in data_points]
        result["availability"] = device.calculate_availability()
        result["is_healthy"] = device.is_healthy()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/devices")
async def create_device(device_data: DeviceCreateRequest):
    """Create new device"""
    try:
        # Validate protocol exists if specified
        if device_data.protocol_id:
            protocol = await Protocol.get(device_data.protocol_id)
            if not protocol:
                raise HTTPException(status_code=400, detail="Protocol not found")
        
        # Validate connection exists if specified
        if device_data.connection_id:
            connection = await Connection.get(device_data.connection_id)
            if not connection:
                raise HTTPException(status_code=400, detail="Connection not found")
        
        device = Device(**device_data.dict())
        await device.insert()
        
        result = device.dict()
        result["id"] = str(device.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/devices/{device_id}")
async def update_device(device_id: str, device_data: DeviceUpdateRequest):
    """Update device"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Validate protocol if being updated
        if device_data.protocol_id:
            protocol = await Protocol.get(device_data.protocol_id)
            if not protocol:
                raise HTTPException(status_code=400, detail="Protocol not found")
        
        # Update fields
        update_data = device_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(device, field, value)
        
        device.updated_at = datetime.utcnow()
        await device.save()
        
        result = device.dict()
        result["id"] = str(device.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/devices/{device_id}")
async def delete_device(device_id: str):
    """Delete device and associated data points"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Delete associated data points
        await DataPoint.find({"device_id": device_id}).delete()
        
        await device.delete()
        return {"success": True, "message": "Device deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/devices/{device_id}/test")
async def test_device_connection(device_id: str):
    """Test device connection"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        protocol = await Protocol.get(device.protocol_id) if device.protocol_id else None
        if not protocol:
            raise HTTPException(status_code=400, detail="Device has no associated protocol")
        
        from services.protocol_services import get_protocol_service
        service = get_protocol_service(protocol.type)
        
        if service:
            start_time = datetime.utcnow()
            success = await service.test_connection(device.address, protocol.configuration)
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Update device stats
            device.update_stats(
                success=success,
                response_time=response_time,
                error_msg=None if success else "Connection test failed"
            )
            await device.save()
            
            return {
                "success": success,
                "response_time_ms": response_time,
                "message": "Connection test successful" if success else "Connection test failed"
            }
        
        return {"success": False, "message": "Protocol service not available"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/tree")
async def get_devices_tree(
    location_id: Optional[str] = Query(None),
    include_data_points: bool = Query(False)
):
    """Get hierarchical tree structure of devices"""
    try:
        query = {}
        if location_id:
            query["location_id"] = location_id
        
        devices = await Device.find(query).to_list()
        tree = []
        
        for device in devices:
            node = device.to_tree_node()
            
            # Add data points if requested
            if include_data_points:
                data_points = await DataPoint.find({"device_id": str(device.id)}).to_list()
                node["children"] = [{
                    "id": str(dp.id),
                    "name": dp.name,
                    "type": "data_point",
                    "address": dp.address,
                    "data_type": dp.data_type,
                    "unit": dp.unit,
                    "current_value": dp.current_value,
                    "last_read": dp.last_read.isoformat() if dp.last_read else None
                } for dp in data_points]
            
            tree.append(node)
        
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/stats")
async def get_device_stats():
    """Get device statistics"""
    try:
        total_devices = await Device.count()
        active_devices = await Device.find({"status": DeviceStatus.ACTIVE}).count()
        error_devices = await Device.find({"status": DeviceStatus.ERROR}).count()
        offline_devices = await Device.find({"online": False}).count()
        
        # Calculate averages
        devices = await Device.find().to_list()
        avg_reliability = sum(d.reliability_percent for d in devices) / max(len(devices), 1)
        avg_availability = sum(d.calculate_availability() for d in devices) / max(len(devices), 1)
        
        # Group by type
        by_type = {}
        for device in devices:
            device_type = device.device_type
            if device_type not in by_type:
                by_type[device_type] = 0
            by_type[device_type] += 1
        
        return {
            "total_devices": total_devices,
            "active_devices": active_devices,
            "error_devices": error_devices,
            "offline_devices": offline_devices,
            "online_devices": total_devices - offline_devices,
            "average_reliability": round(avg_reliability, 2),
            "average_availability": round(avg_availability, 2),
            "by_type": by_type,
            "health_score": round((avg_reliability + avg_availability) / 2, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))