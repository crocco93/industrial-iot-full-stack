from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
import json
from typing import Dict, Set, Any, Optional
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class WebSocketManager:
    def __init__(self):
        # Store active connections by channel
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "monitoring": set(),
            "connections": set(),
            "logs": set(),
            "alerts": set()  # ✅ Added alerts channel
        }
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.periodic_task: Optional[asyncio.Task] = None
    
    def start_background_tasks(self):
        """Start background tasks"""
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
        if self.periodic_task is None or self.periodic_task.done():
            self.periodic_task = asyncio.create_task(self._periodic_updates_loop())
    
    async def connect(self, websocket: WebSocket, channel: str):
        """Connect WebSocket to channel"""
        try:
            await websocket.accept()
            
            if channel not in self.active_connections:
                self.active_connections[channel] = set()
            
            self.active_connections[channel].add(websocket)
            self.connection_info[websocket] = {
                "channel": channel,
                "connected_at": datetime.now(),
                "messages_sent": 0,
                "messages_received": 0,
                "last_heartbeat": datetime.now().timestamp()
            }
            
            logger.info(f"WebSocket connected to {channel}. Total: {len(self.active_connections[channel])}")
            
            # Send welcome message
            await self.send_to_websocket(websocket, {
                "type": "connection_established",
                "channel": channel,
                "timestamp": datetime.now().isoformat(),
                "server_info": {
                    "channel_connections": len(self.active_connections[channel]),
                    "total_connections": sum(len(conns) for conns in self.active_connections.values())
                }
            })
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket to {channel}: {e}")
            raise

    def disconnect(self, websocket: WebSocket):
        """Disconnect WebSocket from all channels"""
        try:
            channel_name = None
            if websocket in self.connection_info:
                channel_name = self.connection_info[websocket]["channel"]
                del self.connection_info[websocket]
            
            # Remove from all channels
            for channel, connections in self.active_connections.items():
                connections.discard(websocket)
            
            if channel_name:
                logger.info(f"WebSocket disconnected from {channel_name}")
                
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")

    async def send_to_websocket(self, websocket: WebSocket, message: dict):
        """Send message to specific WebSocket"""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps(message, default=str))
                
                # Update counter
                if websocket in self.connection_info:
                    self.connection_info[websocket]["messages_sent"] += 1
                    
        except Exception as e:
            logger.debug(f"Error sending message to WebSocket: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict, channel: str):
        """Broadcast message to all connections in channel"""
        if channel not in self.active_connections:
            return
        
        # Add timestamp
        message["timestamp"] = datetime.now().isoformat()
        
        # Get copy to avoid modification during iteration
        connections = self.active_connections[channel].copy()
        
        if not connections:
            return
        
        disconnected = []
        
        for connection in connections:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_text(json.dumps(message, default=str))
                    
                    # Update counter
                    if connection in self.connection_info:
                        self.connection_info[connection]["messages_sent"] += 1
                else:
                    disconnected.append(connection)
                    
            except Exception as e:
                logger.debug(f"Error broadcasting to connection in {channel}: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected WebSockets
        for conn in disconnected:
            self.active_connections[channel].discard(conn)
            if conn in self.connection_info:
                del self.connection_info[conn]
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeat to all connections"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                heartbeat_message = {
                    "type": "heartbeat",
                    "data": {
                        "server_time": datetime.now().isoformat(),
                        "uptime_seconds": int(datetime.now().timestamp()) % 86400
                    }
                }
                
                for channel in self.active_connections.keys():
                    await self.broadcast(heartbeat_message, channel)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(30)
    
    async def _periodic_updates_loop(self):
        """Send periodic system updates"""
        while True:
            try:
                await asyncio.sleep(10)  # Every 10 seconds
                
                # Broadcast system status
                system_status = {
                    "type": "system_status",
                    "data": {
                        "active_websockets": sum(len(conns) for conns in self.active_connections.values()),
                        "memory_usage": 45.2,  # Mock data
                        "cpu_usage": 23.1,     # Mock data
                        "disk_usage": 67.8     # Mock data
                    }
                }
                
                await self.broadcast(system_status, "monitoring")
                
                # Random alerts for demonstration
                if datetime.now().second % 60 == 0:  # Every minute
                    await self.broadcast_alert(
                        "system_info",
                        "System Health Check",
                        "Routine system health check completed successfully",
                        "info",
                        "monitoring_system"
                    )
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Periodic updates error: {e}")
                await asyncio.sleep(10)
    
    async def broadcast_alert(self, alert_type: str, title: str, message_text: str, severity: str = "info", source: str = "system", **kwargs):
        """Broadcast system alert"""
        alert_data = {
            "id": f"alert_{int(datetime.now().timestamp())}_{abs(hash(title)) % 1000}",
            "type": alert_type,
            "title": title,
            "message": message_text,
            "severity": severity,
            "source": source,
            "timestamp": datetime.now().isoformat(),
            "acknowledged": False,
            **kwargs
        }
        
        message = {
            "type": "alert",
            "data": alert_data
        }
        
        await self.broadcast(message, "alerts")
        logger.info(f"Alert broadcast: {title} ({severity})")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        return {
            "channels": {ch: len(conns) for ch, conns in self.active_connections.items()},
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "connection_details": [
                {
                    "channel": info["channel"],
                    "connected_at": info["connected_at"].isoformat(),
                    "messages_sent": info["messages_sent"],
                    "messages_received": info["messages_received"]
                }
                for info in self.connection_info.values()
            ]
        }

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Start background tasks immediately
websocket_manager.start_background_tasks()

@router.websocket("/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint for system alerts"""
    await websocket_manager.connect(websocket, "alerts")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            websocket_manager.connection_info[websocket]["messages_received"] += 1
            
            # Handle client messages
            if message.get("type") == "subscribe":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "subscription_confirmed",
                    "channel": "alerts",
                    "filters": message.get("filters", {})
                })
            elif message.get("type") == "acknowledge_alert":
                alert_id = message.get("alert_id")
                # Handle alert acknowledgment
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "alert_acknowledged",
                    "alert_id": alert_id
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected from alerts channel")
    except Exception as e:
        logger.error(f"Error in alerts WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

@router.websocket("/monitoring")
async def websocket_monitoring(websocket: WebSocket):
    """WebSocket endpoint for monitoring data"""
    await websocket_manager.connect(websocket, "monitoring")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            websocket_manager.connection_info[websocket]["messages_received"] += 1
            
            if message.get("type") == "subscribe":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "subscription_confirmed",
                    "channel": "monitoring",
                    "filters": message.get("filters", {})
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected from monitoring channel")
    except Exception as e:
        logger.error(f"Error in monitoring WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

@router.websocket("/connections")
async def websocket_connections(websocket: WebSocket):
    """WebSocket endpoint for connection status"""
    await websocket_manager.connect(websocket, "connections")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            websocket_manager.connection_info[websocket]["messages_received"] += 1
            
            if message.get("type") == "ping":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "pong"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected from connections channel")
    except Exception as e:
        logger.error(f"Error in connections WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

@router.websocket("/logs")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint for system logs"""
    await websocket_manager.connect(websocket, "logs")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            websocket_manager.connection_info[websocket]["messages_received"] += 1
            
            if message.get("type") == "stream_logs":
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "log_stream_started",
                    "filters": {
                        "level": message.get("level"),
                        "source": message.get("source")
                    }
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected from logs channel")
    except Exception as e:
        logger.error(f"Error in logs WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

# Helper functions for broadcasting
async def broadcast_monitoring_data(protocol_id: str, connection_id: str, metrics: dict):
    """Broadcast monitoring data"""
    message = {
        "type": "monitoring_data",
        "data": {
            "protocol_id": protocol_id,
            "connection_id": connection_id,
            "metrics": metrics
        }
    }
    await websocket_manager.broadcast(message, "monitoring")

async def broadcast_connection_status(connection_id: str, status: str, **kwargs):
    """Broadcast connection status update"""
    message = {
        "type": "connection_status",
        "data": {
            "connection_id": connection_id,
            "status": status,
            **kwargs
        }
    }
    await websocket_manager.broadcast(message, "connections")

async def broadcast_log_entry(level: str, source: str, message_text: str, metadata: dict = None):
    """Broadcast log entry"""
    message = {
        "type": "log_entry",
        "data": {
            "level": level,
            "source": source,
            "message": message_text,
            "metadata": metadata or {}
        }
    }
    await websocket_manager.broadcast(message, "logs")

async def broadcast_alert(alert_type: str, title: str, message_text: str, severity: str = "info", source: str = "system", **kwargs):
    """Broadcast system alert"""
    alert_data = {
        "id": f"alert_{int(datetime.now().timestamp())}_{abs(hash(title + message_text)) % 1000}",
        "type": alert_type,
        "title": title,
        "message": message_text,
        "severity": severity,
        "source": source,
        "timestamp": datetime.now().isoformat(),
        "acknowledged": False,
        "actions": [],
        **kwargs
    }
    
    message = {
        "type": "alert",
        "data": alert_data
    }
    
    await websocket_manager.broadcast(message, "alerts")
    logger.info(f"Alert broadcast: {title} ({severity})")
    
    # Also log as system log
    await broadcast_log_entry(severity, f"alert.{source}", f"{title}: {message_text}", {
        "alert_id": alert_data["id"],
        "alert_type": alert_type
    })

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Export for main.py
__all__ = ["router", "websocket_manager", "broadcast_monitoring_data", "broadcast_connection_status", "broadcast_log_entry", "broadcast_alert"]