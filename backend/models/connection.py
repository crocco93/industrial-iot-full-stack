from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from models.connection import Connection, ConnectionStatus
from models.protocol import Protocol

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
            connection_dict["protocol"] = {
                "id": str(protocol.id),
                "name": protocol.name,
                "type": protocol.type
            } if protocol else None
            
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

@router.post("/connections/{connection_id}/test")
async def test_connection(connection_id: str):
    """Test connection"""
    try:
        connection = await Connection.get(connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        protocol = await Protocol.get(connection.protocol_id)
        if not protocol:
            raise HTTPException(status_code=404, detail="Protocol not found")
        
        from services.protocol_services import get_protocol_service
        service = get_protocol_service(protocol.type)
        
        if service:
            success = await service.test_connection(connection.address, protocol.configuration)
            
            # Update connection status
            connection.status = ConnectionStatus.ACTIVE if success else ConnectionStatus.ERROR
            connection.last_seen = datetime.now()
            await connection.save()
            
            return {
                "success": success,
                "message": "Connection test successful" if success else "Connection test failed"
            }
        
        return {"success": False, "message": "Protocol service not available"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connections/stats")
async def get_connection_stats():
    """Get connection statistics"""
    try:
        total_connections = await Connection.count()
        active_connections = await Connection.find(Connection.status == ConnectionStatus.ACTIVE).count()
        error_connections = await Connection.find(Connection.status == ConnectionStatus.ERROR).count()
        
        # Calculate data transfer stats
        connections = await Connection.find_all().to_list()
        total_bytes = sum(conn.bytes_transferred or 0 for conn in connections)
        total_errors = sum(conn.error_count or 0 for conn in connections)
        
        return {
            "totalConnections": total_connections,
            "activeConnections": active_connections,
            "errorConnections": error_connections,
            "inactiveConnections": total_connections - active_connections - error_connections,
            "totalBytesTransferred": total_bytes,
            "totalErrors": total_errors,
            "averageDataRate": round(total_bytes / max(total_connections, 1), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
