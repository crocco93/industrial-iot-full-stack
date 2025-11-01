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
            "alerts": set(),
            "data": set(),
            "system": set()
        }
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.periodic_task: Optional[asyncio.Task] = None
        self._is_running = False
    
    def start_background_tasks(self):
        """Start background tasks"""
        if self._is_running:
            return
            
        self._is_running = True
        
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            logger.info("Started WebSocket heartbeat task")
        
        if self.periodic_task is None or self.periodic_task.done():
            self.periodic_task = asyncio.create_task(self._periodic_updates_loop())
            logger.info("Started WebSocket periodic updates task")
    
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
                "last_heartbeat": datetime.now().timestamp(),
                "client_id": f"{channel}_{len(self.active_connections[channel])}"
            }
            
            logger.info(f"WebSocket connected to '{channel}' channel. Active connections: {len(self.active_connections[channel])}")
            
            # Send welcome message
            await self.send_to_websocket(websocket, {
                "type": "connection_established",
                "channel": channel,
                "timestamp": datetime.now().isoformat(),
                "client_id": self.connection_info[websocket]["client_id"],
                "server_info": {
                    "channel_connections": len(self.active_connections[channel]),
                    "total_connections": sum(len(conns) for conns in self.active_connections.values()),
                    "available_channels": list(self.active_connections.keys())
                }
            })
            
            # Send initial data based on channel
            if channel == "alerts":
                await self.send_initial_alerts(websocket)
            elif channel == "monitoring":
                await self.send_initial_monitoring(websocket)
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket to {channel}: {e}")
            raise

    async def send_initial_alerts(self, websocket: WebSocket):
        """Send initial alert data when client connects"""
        try:
            # Import here to avoid circular imports
            from .alerts import alerts_storage, create_sample_alerts
            
            # Ensure sample data exists
            if not alerts_storage:
                sample_alerts = create_sample_alerts()
                for alert in sample_alerts:
                    alerts_storage[alert.id] = alert
            
            # Send recent unacknowledged alerts
            recent_alerts = [alert.dict() for alert in alerts_storage.values() if not alert.acknowledged]
            recent_alerts.sort(key=lambda x: x['timestamp'], reverse=True)
            
            await self.send_to_websocket(websocket, {
                "type": "initial_alerts",
                "data": {
                    "alerts": recent_alerts[:10],  # Send latest 10
                    "total_count": len(recent_alerts),
                    "unacknowledged_count": len(recent_alerts)
                }
            })
            
        except Exception as e:
            logger.error(f"Error sending initial alerts: {e}")
    
    async def send_initial_monitoring(self, websocket: WebSocket):
        """Send initial monitoring data"""
        try:
            await self.send_to_websocket(websocket, {
                "type": "initial_monitoring",
                "data": {
                    "system_status": "online",
                    "protocols_active": 6,
                    "devices_connected": 12,
                    "data_points_monitored": 48,
                    "last_update": datetime.now().isoformat()
                }
            })
        except Exception as e:
            logger.error(f"Error sending initial monitoring data: {e}")

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
                remaining = len(self.active_connections.get(channel_name, set()))
                logger.info(f"WebSocket disconnected from '{channel_name}' channel. Remaining: {remaining}")
                
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")

    async def send_to_websocket(self, websocket: WebSocket, message: dict):
        """Send message to specific WebSocket"""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                # Add server timestamp
                message["server_timestamp"] = datetime.now().isoformat()
                
                await websocket.send_text(json.dumps(message, default=str))
                
                # Update counter
                if websocket in self.connection_info:
                    self.connection_info[websocket]["messages_sent"] += 1
                    self.connection_info[websocket]["last_heartbeat"] = datetime.now().timestamp()
                    
        except Exception as e:
            logger.debug(f"Error sending message to WebSocket: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict, channel: str):
        """Broadcast message to all connections in channel"""
        if channel not in self.active_connections:
            logger.warning(f"Attempted to broadcast to unknown channel: {channel}")
            return
        
        # Add server metadata
        message["server_timestamp"] = datetime.now().isoformat()
        message["broadcast_channel"] = channel
        
        # Get copy to avoid modification during iteration
        connections = self.active_connections[channel].copy()
        
        if not connections:
            logger.debug(f"No connections in channel '{channel}' for broadcast")
            return
        
        logger.debug(f"Broadcasting to {len(connections)} connections in '{channel}' channel")
        
        disconnected = []
        successful_sends = 0
        
        for connection in connections:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_text(json.dumps(message, default=str))
                    successful_sends += 1
                    
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
        
        if disconnected:
            logger.info(f"Cleaned up {len(disconnected)} disconnected WebSockets from '{channel}'")
            
        logger.debug(f"Successfully broadcast to {successful_sends}/{len(connections)} connections in '{channel}'")
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeat to all connections"""
        logger.info("WebSocket heartbeat loop started")
        
        while self._is_running:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                current_time = datetime.now()
                heartbeat_message = {
                    "type": "heartbeat",
                    "data": {
                        "server_time": current_time.isoformat(),
                        "uptime_seconds": int(current_time.timestamp()) % 86400,
                        "active_connections": sum(len(conns) for conns in self.active_connections.values())
                    }
                }
                
                # Send heartbeat to all channels
                for channel in self.active_connections.keys():
                    if self.active_connections[channel]:  # Only if there are connections
                        await self.broadcast(heartbeat_message, channel)
                
                logger.debug("Heartbeat sent to all channels")
                        
            except asyncio.CancelledError:
                logger.info("WebSocket heartbeat loop cancelled")
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(30)
    
    async def _periodic_updates_loop(self):
        """Send periodic system updates"""
        logger.info("WebSocket periodic updates loop started")
        
        while self._is_running:
            try:
                await asyncio.sleep(15)  # Every 15 seconds
                
                # Broadcast system status to monitoring channel
                system_status = {
                    "type": "system_status",
                    "data": {
                        "active_websockets": sum(len(conns) for conns in self.active_connections.values()),
                        "channels": {ch: len(conns) for ch, conns in self.active_connections.items()},
                        "memory_usage_percent": 45.2 + (datetime.now().second % 10),  # Mock varying data
                        "cpu_usage_percent": 23.1 + (datetime.now().second % 15),
                        "disk_usage_percent": 67.8,
                        "protocols_active": 6,
                        "devices_online": 12
                    }
                }
                
                await self.broadcast(system_status, "monitoring")
                
                # Periodic demo alerts (only if connections exist)
                if (datetime.now().minute % 3 == 0 and 
                    datetime.now().second < 15 and 
                    self.active_connections["alerts"]):
                    
                    await self.broadcast_alert(
                        "system_check",
                        "Kontrola systemu",
                        "Automatyczna kontrola systemu zakończona pomyślnie",
                        "info",
                        "system_monitor"
                    )
                
            except asyncio.CancelledError:
                logger.info("WebSocket periodic updates loop cancelled")
                break
            except Exception as e:
                logger.error(f"Periodic updates error: {e}")
                await asyncio.sleep(15)
    
    async def broadcast_alert(self, alert_type: str, title: str, message_text: str, severity: str = "info", source: str = "system", **kwargs):
        """Broadcast system alert to all alert channel connections"""
        try:
            alert_data = {
                "id": f"alert_{int(datetime.now().timestamp())}_{abs(hash(title + message_text)) % 1000}",
                "type": alert_type,
                "title": title,
                "message": message_text,
                "severity": severity,
                "source": source,
                "timestamp": datetime.now().isoformat(),
                "acknowledged": False,
                "resolved": False,
                "metadata": kwargs
            }
            
            message = {
                "type": "new_alert",
                "data": alert_data
            }
            
            # Broadcast to alerts channel
            await self.broadcast(message, "alerts")
            
            # Also broadcast to system channel for general notifications
            await self.broadcast({
                "type": "system_notification",
                "data": {
                    "category": "alert",
                    "title": title,
                    "message": message_text,
                    "severity": severity,
                    "alert_id": alert_data["id"]
                }
            }, "system")
            
            logger.info(f"Alert broadcast: {title} ({severity}) from {source}")
            
        except Exception as e:
            logger.error(f"Error broadcasting alert: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        return {
            "channels": {ch: len(conns) for ch, conns in self.active_connections.items()},
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "is_running": self._is_running,
            "heartbeat_active": self.heartbeat_task and not self.heartbeat_task.done(),
            "periodic_updates_active": self.periodic_task and not self.periodic_task.done()
        }
    
    def stop_background_tasks(self):
        """Stop background tasks"""
        self._is_running = False
        
        if self.heartbeat_task and not self.heartbeat_task.done():
            self.heartbeat_task.cancel()
            
        if self.periodic_task and not self.periodic_task.done():
            self.periodic_task.cancel()
            
        logger.info("WebSocket background tasks stopped")

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Start background tasks when module is imported
websocket_manager.start_background_tasks()

@router.websocket("/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    """WebSocket endpoint for system alerts - FIXED"""
    await websocket_manager.connect(websocket, "alerts")
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Update received message counter
                if websocket in websocket_manager.connection_info:
                    websocket_manager.connection_info[websocket]["messages_received"] += 1
                    websocket_manager.connection_info[websocket]["last_heartbeat"] = datetime.now().timestamp()
                
                # Handle different message types
                if message.get("type") == "subscribe":
                    await websocket_manager.send_to_websocket(websocket, {
                        "type": "subscription_confirmed",
                        "channel": "alerts",
                        "filters": message.get("filters", {}),
                        "message": "Successfully subscribed to alerts"
                    })
                    
                elif message.get("type") == "acknowledge_alert":
                    alert_id = message.get("alert_id")
                    # Handle alert acknowledgment
                    await websocket_manager.send_to_websocket(websocket, {
                        "type": "alert_acknowledged",
                        "alert_id": alert_id,
                        "acknowledged_by": message.get("user_id", "unknown"),
                        "timestamp": datetime.now().isoformat()
                    })
                    
                elif message.get("type") == "ping":
                    await websocket_manager.send_to_websocket(websocket, {
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    })
                    
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON received on alerts WebSocket: {e}")
                await websocket_manager.send_to_websocket(websocket, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected from alerts channel")
    except Exception as e:
        logger.error(f"Error in alerts WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

@router.websocket("/monitoring")
async def websocket_monitoring_endpoint(websocket: WebSocket):
    """WebSocket endpoint for monitoring data"""
    await websocket_manager.connect(websocket, "monitoring")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if websocket in websocket_manager.connection_info:
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
async def websocket_connections_endpoint(websocket: WebSocket):
    """WebSocket endpoint for connection status"""
    await websocket_manager.connect(websocket, "connections")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if websocket in websocket_manager.connection_info:
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

@router.websocket("/system")
async def websocket_system_endpoint(websocket: WebSocket):
    """WebSocket endpoint for general system notifications"""
    await websocket_manager.connect(websocket, "system")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if websocket in websocket_manager.connection_info:
                websocket_manager.connection_info[websocket]["messages_received"] += 1
            
            # Echo back for testing
            await websocket_manager.send_to_websocket(websocket, {
                "type": "echo",
                "original_message": message
            })
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected from system channel")
    except Exception as e:
        logger.error(f"Error in system WebSocket: {e}")
    finally:
        websocket_manager.disconnect(websocket)

# Helper functions for broadcasting (used by other API modules)
async def broadcast_monitoring_data(protocol_id: str, connection_id: str, metrics: dict):
    """Broadcast monitoring data"""
    message = {
        "type": "monitoring_data",
        "data": {
            "protocol_id": protocol_id,
            "connection_id": connection_id,
            "metrics": metrics,
            "timestamp": datetime.now().isoformat()
        }
    }
    await websocket_manager.broadcast(message, "monitoring")

async def broadcast_connection_status(connection_id: str, status: str, protocol_type: str = None, **kwargs):
    """Broadcast connection status update"""
    message = {
        "type": "connection_status",
        "data": {
            "connection_id": connection_id,
            "status": status,
            "protocol_type": protocol_type,
            "timestamp": datetime.now().isoformat(),
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
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat()
        }
    }
    await websocket_manager.broadcast(message, "logs")

async def broadcast_alert(alert_type: str, title: str, message_text: str, severity: str = "info", source: str = "system", **kwargs):
    """Broadcast system alert - MAIN FUNCTION USED BY alerts.py"""
    try:
        await websocket_manager.broadcast_alert(alert_type, title, message_text, severity, source, **kwargs)
        
        # Also save to alerts storage if not already done
        try:
            from .alerts import alerts_storage, SystemAlert
            
            alert = SystemAlert(
                id=f"alert_{int(datetime.now().timestamp())}_{abs(hash(title + message_text)) % 1000}",
                type=alert_type,
                title=title,
                message=message_text,
                severity=severity,
                source=source,
                timestamp=datetime.now(),
                metadata=kwargs
            )
            
            alerts_storage[alert.id] = alert
            
        except Exception as e:
            logger.warning(f"Could not save alert to storage: {e}")
        
    except Exception as e:
        logger.error(f"Error broadcasting alert: {e}")

# Export commonly used items
__all__ = [
    "router", 
    "websocket_manager", 
    "broadcast_monitoring_data", 
    "broadcast_connection_status", 
    "broadcast_log_entry", 
    "broadcast_alert"
]