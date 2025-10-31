from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from models.device import Device, DeviceStatus
from models.protocol import Protocol

router = APIRouter()

@router.get("/devices", response_model=List[dict])
async def get_devices():
    """Get list of all devices"""
    try:
        devices = await Device.find_all().to_list()
        device_list = []
        
        for device in devices:
            # Get protocol info
            protocol = await Protocol.get(device.protocol_id)
            
            device_dict = device.dict()
            device_dict["id"] = str(device.id)
            device_dict["protocol"] = {
                "id": str(protocol.id),
                "name": protocol.name,
                "type": protocol.type
            } if protocol else None
            
            device_list.append(device_dict)
        
        return device_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}")
async def get_device(device_id: str):
    """Get device by ID"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Get protocol info
        protocol = await Protocol.get(device.protocol_id)
        
        result = device.dict()
        result["id"] = str(device.id)
        result["protocol"] = {
            "id": str(protocol.id),
            "name": protocol.name,
            "type": protocol.type
        } if protocol else None
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/devices")
async def create_device(device_data: dict):
    """Create new device"""
    try:
        # Validate protocol exists
        protocol = await Protocol.get(device_data.get("protocolId"))
        if not protocol:
            raise HTTPException(status_code=400, detail="Protocol not found")
        
        device = Device(
            name=device_data.get("name", ""),
            description=device_data.get("description", ""),
            protocol_id=device_data.get("protocolId", ""),
            address=device_data.get("address", ""),
            status=DeviceStatus.INACTIVE,
            read_frequency=device_data.get("readFrequency", 1000)
        )
        
        await device.insert()
        
        result = device.dict()
        result["id"] = str(device.id)
        result["protocol"] = {
            "id": str(protocol.id),
            "name": protocol.name,
            "type": protocol.type
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/devices/{device_id}")
async def update_device(device_id: str, device_data: dict):
    """Update device"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Update fields
        for field, value in device_data.items():
            if field in ["name", "description", "address", "status", "readFrequency"]:
                if field == "status":
                    value = DeviceStatus(value)
                setattr(device, field.replace("F", "_f") if "F" in field else field, value)
        
        device.updated_at = datetime.now()
        await device.save()
        
        # Get updated protocol info
        protocol = await Protocol.get(device.protocol_id)
        
        result = device.dict()
        result["id"] = str(device.id)
        result["protocol"] = {
            "id": str(protocol.id),
            "name": protocol.name,
            "type": protocol.type
        } if protocol else None
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/devices/{device_id}")
async def delete_device(device_id: str):
    """Delete device"""
    try:
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Delete associated data points
        from models.datapoint import DataPoint
        await DataPoint.find(DataPoint.device_id == device_id).delete()
        
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
        
        protocol = await Protocol.get(device.protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        from services.protocol_services import get_protocol_service
        service = get_protocol_service(protocol.type)
        
        if service:
            success = await service.test_connection(device.address, protocol.configuration)
            return {
                "success": success,
                "message": "Connection test successful" if success else "Connection test failed"
            }
        
        return {"success": False, "message": "Protocol service not available"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
