from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime

from models.connection import Connection, ConnectionStatus
from models.protocol import Protocol
from services.protocol_services import get_protocol_service
import asyncio
from pydantic import BaseModel, validator

router = APIRouter()


class ConnectionCreate(BaseModel):
    name: str
    protocol_id: str
    address: str
    configuration: Optional[dict] = {}
    
    @validator('address')
    def validate_address(cls, v):
        if not v.strip():
            raise ValueError("Address cannot be empty")
        return v.strip()


router = APIRouter()

@router.get("/connections", response_model=List[dict])
async def get_connections():
    """Get list of all connections"""
    try:
        connections = await Connection.find_all().to_list()
        connection_list = []
        
        for connection in connections:
            # Get protocol info
            protocol = await Protocol.get(connection.protocol_id)
            
            connection_dict = connection.dict()
            connection_dict["id"] = str(connection.id)
            connection_dict["protocol"] = protocol.dict() if protocol else None
            if protocol:
                connection_dict["protocol"]["id"] = str(protocol.id)
            
            connection_list.append(connection_dict)
            
        return connection_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connections/{connection_id}")
async def get_connection(connection_id: str):
    """Get connection by ID"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Get protocol info
        protocol = await Protocol.get(connection.protocol_id)
        
        result = connection.dict()
        result["id"] = str(connection.id)
        result["protocol"] = protocol.dict() if protocol else None
        if protocol:
            result["protocol"]["id"] = str(protocol.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/connections")
async def create_connection(connection_data: dict):
    """Create new connection"""
    try:
        # Validate protocol exists
        protocol = await Protocol.get(connection_data.get("protocol_id"))
        if not protocol:
            raise HTTPException(status_code=400, detail="Protocol not found")
        
        connection = Connection(
            name=connection_data.get("name", ""),
            protocol_id=connection_data.get("protocol_id"),
            address=connection_data.get("address", ""),
            configuration=connection_data.get("configuration", {}),
            status=ConnectionStatus.INACTIVE
        )
        
        await connection.insert()
        
        result = connection.dict()
        result["id"] = str(connection.id)
        result["protocol"] = protocol.dict()
        result["protocol"]["id"] = str(protocol.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/connections/{connection_id}")
async def update_connection(connection_id: str, connection_data: dict):
    """Update connection"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Update fields
        for field, value in connection_data.items():
            if field in ["name", "address", "configuration"]:
                setattr(connection, field, value)
        
        connection.updated_at = datetime.now()
        await connection.save()
        
        result = connection.dict()
        result["id"] = str(connection.id)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str):
    """Delete connection"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        await connection.delete()
        
        return {"success": True, "message": "Connection deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/connections/{connection_id}/test")
async def test_connection(connection_id: str):
    """Test connection with timeout"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Get protocol service
        protocol = await Protocol.get(connection.protocol_id)
        if not protocol:
            raise HTTPException(status_code=400, detail="Protocol not found")
        
        service = get_protocol_service(protocol.type)
        if not service:
            return {
                "success": False,
                "message": f"No service available for protocol type {protocol.type}"
            }
        
        # Test the connection with timeout
        try:
            test_result = await asyncio.wait_for(
                service.test_connection(connection.address, connection.configuration),
                timeout=30.0  # 30 second timeout
            )
        except asyncio.TimeoutError:
            test_result = False
            connection.status = ConnectionStatus.TIMEOUT
        
        # Update connection status
        if test_result:
            connection.status = ConnectionStatus.ACTIVE
            connection.last_seen = datetime.utcnow()
            connection.error_count = 0
        else:
            connection.status = ConnectionStatus.ERROR
            connection.error_count += 1
        
        await connection.save()
        
        return {
            "success": test_result,
            "message": "Connection test successful" if test_result else "Connection test failed",
            "status": connection.status,
            "last_tested": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

@router.get("/connections/{connection_id}/status")
async def get_connection_status(connection_id: str):
    """Get connection status"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        return {
            "id": str(connection.id),
            "status": connection.status,
            "last_seen": connection.last_seen,
            "data_rate": connection.data_rate,
            "bytes_transferred": connection.bytes_transferred,
            "error_count": connection.error_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))