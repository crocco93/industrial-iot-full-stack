from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
import json
from typing import Dict, Set
import asyncio
from datetime import datetime
import time
import logging
import asyncio
from typing import Dict, Set, Optional

logger = logging.getLogger(__name__)
router = APIRouter()

class WebSocketManager:
    def __init__(self):
        # Store active connections by channel with metadata
        self.active_connections: Dict[str, Dict[WebSocket, Dict]] = {
            "monitoring": {},
            "connections": {},
            "logs": {}
        }
        self.heartbeat_task: Optional[asyncio.Task] = None
    
    def start_heartbeat(self):
        """Start periodic heartbeat to maintain connections"""
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        
    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
    
    async def broadcast(self, message: dict, channel: str):
        if channel in self.active_connections:
            # Make a copy of the set to avoid modification during iteration
            connections = self.active_connections[channel].copy()
            for connection in connections:
                try:
                    if connection.client_state == WebSocketState.CONNECTED:
                        await connection.send_text(json.dumps(message))
                except Exception:
                    # Remove broken connection
                    self.active_connections[channel].discard(connection)
    
    async def send_to_websocket(self, websocket: WebSocket, message: dict):
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps(message))
        except Exception:
            pass
    async def _heartbeat_loop(self):
        """Send periodic heartbeat to all connections"""
        while True:
            try:
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
                for channel in self.active_connections:
                    await self._send_heartbeat(channel)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
    
    async def _send_heartbeat(self, channel: str):
        """Send heartbeat to all connections in channel"""
        if channel not in self.active_connections:
            return
        
        connections_to_remove = []
        heartbeat_message = {
            "type": "heartbeat",
            "timestamp": datetime.utcnow().isoformat(),
            "channel": channel
        }
        
        for websocket, metadata in self.active_connections[channel].items():
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps(heartbeat_message))
                    metadata["last_heartbeat"] = time.time()
                else:
                    connections_to_remove.append(websocket)
            except Exception:
                connections_to_remove.append(websocket)
        
        # Clean up broken connections
        for ws in connections_to_remove:
            self.active_connections[channel].pop(ws, None)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()

@router.websocket("/monitoring")
async def websocket_monitoring(websocket: WebSocket):
    await websocket_manager.connect(websocket, "monitoring")
    
    # Send initial connection confirmation
    await websocket_manager.send_to_websocket(websocket, {
        "type": "connection_established",
        "channel": "monitoring",
        "timestamp": datetime.now().isoformat()
    })
    
    try:
        while True:
            # Listen for client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle subscription requests
            if message.get("type") == "subscribe":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "subscription_confirmed",
                    "channel": "monitoring",
                    "filters": message.get("filters", {}),
                    "timestamp": datetime.now().isoformat()
                })
            
            # Echo message for testing
            await websocket_manager.send_to_websocket(websocket, {
                "type": "echo",
                "received": message,
                "timestamp": datetime.now().isoformat()
            })
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, "monitoring")

@router.websocket("/connections")
async def websocket_connections(websocket: WebSocket):
    await websocket_manager.connect(websocket, "connections")
    
    # Send initial connection confirmation
    await websocket_manager.send_to_websocket(websocket, {
        "type": "connection_established",
        "channel": "connections",
        "timestamp": datetime.now().isoformat()
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, "connections")

@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket_manager.connect(websocket, "logs")
    
    # Send initial connection confirmation
    await websocket_manager.send_to_websocket(websocket, {
        "type": "connection_established",
        "channel": "logs",
        "timestamp": datetime.now().isoformat()
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle log streaming requests
            if message.get("type") == "stream_logs":
                level_filter = message.get("level")
                source_filter = message.get("source")
                
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "log_stream_started",
                    "filters": {
                        "level": level_filter,
                        "source": source_filter
                    },
                    "timestamp": datetime.now().isoformat()
                })
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, "logs")

# Helper function to broadcast monitoring data (used by monitoring services)
async def broadcast_monitoring_data(protocol_id: str, connection_id: str, metrics: dict):
    message = {
        "type": "monitoring_data",
        "data": {
            "timestamp": datetime.now().isoformat(),
            "protocol_id": protocol_id,
            "connection_id": connection_id,
            "metrics": metrics
        }
    }
    await websocket_manager.broadcast(message, "monitoring")

# Helper function to broadcast connection status updates
async def broadcast_connection_status(connection_id: str, status: str, last_seen: str, data_rate: str):
    message = {
        "type": "connection_status",
        "data": {
            "connection_id": connection_id,
            "status": status,
            "last_seen": last_seen,
            "data_rate": data_rate,
            "timestamp": datetime.now().isoformat()
        }
    }
    await websocket_manager.broadcast(message, "connections")

# Helper function to broadcast log entries
async def broadcast_log_entry(level: str, source: str, message_text: str, metadata: dict = None):
    message = {
        "type": "log_entry",
        "data": {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "source": source,
            "message": message_text,
            "metadata": metadata or {}
        }
    }
    await websocket_manager.broadcast(message, "logs")

# Export the websocket manager for use in other modules
__all__ = ["websocket_manager", "broadcast_monitoring_data", "broadcast_connection_status", "broadcast_log_entry"]