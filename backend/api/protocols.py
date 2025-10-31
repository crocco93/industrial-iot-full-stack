from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from models.protocol import Protocol, ProtocolType, ProtocolStatus
from models.device import Device
from services.protocol_services import get_protocol_service
from pydantic import BaseModel, validator

# Modele Pydantic dla walidacji
class ProtocolCreate(BaseModel):
    name: str
    type: ProtocolType
    description: Optional[str] = ""
    version: Optional[str] = "1.0"
    configuration: Optional[dict] = {}
    
    @validator('type')
    def validate_protocol_type(cls, v):
        if isinstance(v, str):
            try:
                return ProtocolType(v)
            except ValueError:
                raise ValueError(f"Invalid protocol type: {v}")
        return v

class ProtocolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    configuration: Optional[dict] = None


router = APIRouter()

@router.get("/protocols", response_model=List[dict])
async def get_protocols():
    """Get list of all protocols"""
    try:
        protocols = await Protocol.find_all().to_list()
        protocol_list = []
        
        for protocol in protocols:
            # Get devices for this protocol
            devices = await Device.find(Device.protocol_id == str(protocol.id)).to_list()
            
            protocol_dict = protocol.dict()
            protocol_dict["id"] = str(protocol.id)
            protocol_dict["devices"] = [
                {
                    **device.dict(),
                    "id": str(device.id),
                    "dataPoints": []  # Will be populated separately if needed
                }
                for device in devices
            ]

            protocol_list.append(protocol_dict)
            
        return protocol_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/protocols/{protocol_id}")
async def get_protocol(protocol_id: str):
    """Get protocol by ID"""
    try:
        protocol = await Protocol.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Get devices for this protocol
        devices = await Device.find(Device.protocol_id == protocol_id).to_list()
        
        result = protocol.dict()
        result["id"] = str(protocol.id)
        result["devices"] = [
            {
                **device.dict(),
                "id": str(device.id),
                "dataPoints": []
            }
            for device in devices
        ]

        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/protocols")
async def create_protocol(protocol_data: dict):
    """Create new protocol"""
    try:
        # Validate protocol type
        if "type" in protocol_data and protocol_data["type"] not in [pt.value for pt in ProtocolType]:
            raise HTTPException(status_code=400, detail=f"Invalid protocol type: {protocol_data['type']}")
        
        protocol = Protocol(
            name=protocol_data.get("name", ""),
            type=protocol_data.get("type", ProtocolType.MODBUS_TCP),
            description=protocol_data.get("description", ""),
            version=protocol_data.get("version", "1.0"),
            configuration=protocol_data.get("configuration", {}),
            status=ProtocolStatus.DISCONNECTED
        )
        
        await protocol.insert()
        
        # Start the protocol service
        service = get_protocol_service(protocol.type)
        if service:
            await service.start_protocol(str(protocol.id), protocol.configuration)
        
        result = protocol.dict()
        result["id"] = str(protocol.id)
        result["devices"] = []
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/protocols/{protocol_id}")
async def update_protocol(protocol_id: str, protocol_data: dict):
    """Update protocol"""
    try:
        protocol = await Protocol.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Update fields
        for field, value in protocol_data.items():
            if field in ["name", "description", "version", "configuration"]:
                setattr(protocol, field, value)
        
        protocol.updated_at = datetime.now()
        await protocol.save()
        
        result = protocol.dict()
        result["id"] = str(protocol.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/protocols/{protocol_id}")
async def delete_protocol(protocol_id: str):
    """Delete protocol"""
    try:
        protocol = await Protocol.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        # Stop protocol service
        service = get_protocol_service(protocol.type)
        if service:
            await service.stop_protocol(protocol_id)
        
        # Delete associated devices
        await Device.find(Device.protocol_id == protocol_id).delete()
        
        # Delete protocol
        await protocol.delete()
        
        return {"success": True, "message": "Protocol deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/protocols/{protocol_id}/config")
async def get_protocol_config(protocol_id: str):
    """Get protocol configuration"""
    try:
        protocol = await Protocol.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        return {
            "configuration": protocol.configuration,
            "type": protocol.type,
            "status": protocol.status
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/protocols/{protocol_id}/config")
async def update_protocol_config(protocol_id: str, config_data: dict):
    """Update protocol configuration"""
    try:
        protocol = await Protocol.get(protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        protocol.configuration = config_data.get("configuration", protocol.configuration)
        protocol.updated_at = datetime.now()
        await protocol.save()
        
        # Restart protocol service with new configuration
        service = get_protocol_service(protocol.type)
        if service:
            await service.stop_protocol(protocol_id)
            await service.start_protocol(protocol_id, protocol.configuration)
        
        return {
            "success": True,
            "configuration": protocol.configuration,
            "message": "Configuration updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))