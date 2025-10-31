import asyncio
import json
import logging
from typing import Dict, Set, Any, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manager for WebSocket connections and broadcasting"""
    
    def __init__(self):
        # Store active connections by channel
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "monitoring": set(),
            "connections": set(),
            "logs": set()
        }
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        logger.info("WebSocket Manager initialized")
    
    async def connect(self, websocket: WebSocket, channel: str, client_info: Dict[str, Any] = None):
        """Connect a WebSocket to a specific channel"""
        try:
            await websocket.accept()
            
            if channel not in self.active_connections:
                self.active_connections[channel] = set()
            
            self.active_connections[channel].add(websocket)
            self.connection_info[websocket] = {
                "channel": channel,
                "connected_at": datetime.utcnow(),  # Changed from datetime.now()
                "client_info": client_info or {},
                "messages_sent": 0,
                "messages_received": 0,
                "last_heartbeat": datetime.utcnow()
            }
            
            logger.info(f"WebSocket connected to channel '{channel}'. Total connections in channel: {len(self.active_connections[channel])}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": "connection_confirmed",
                "data": {
                    "channel": channel,
                    "server_time": datetime.utcnow().isoformat() + "Z",
                    "message": f"Connected to {channel} channel"
                }
            }, websocket)
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket to channel {channel}: {e}")
            raise
    
    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket from all channels"""
        try:
            # Find and remove from all channels
            channel_name = None
            for channel, connections in self.active_connections.items():
                if websocket in connections:
                    connections.discard(websocket)
                    channel_name = channel
            
            # Remove connection info
            if websocket in self.connection_info:
                connection_info = self.connection_info[websocket]
                channel_name = connection_info.get("channel", channel_name)
                del self.connection_info[websocket]
            
            if channel_name:
                logger.info(f"WebSocket disconnected from channel '{channel_name}'")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send message to a specific WebSocket"""
        try:
            # Check if connection is still active
            if websocket.client_state != WebSocketState.CONNECTED:
                self.disconnect(websocket)
                return False
            
            # Add timestamp if not present
            if "timestamp" not in message:
                message["timestamp"] = datetime.utcnow().isoformat() + "Z"  # Changed from datetime.now()
            
            await websocket.send_text(json.dumps(message))
            
            # Update message counter
            if websocket in self.connection_info:
                self.connection_info[websocket]["messages_sent"] += 1
            
            return True
            
        except WebSocketDisconnect:
            self.disconnect(websocket)
            return False
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
            return False
    
    async def broadcast(self, message: Dict[str, Any], channel: str):
        """Broadcast message to all connections in a channel"""
        if channel not in self.active_connections:
            logger.warning(f"Attempted to broadcast to non-existent channel: {channel}")
            return
        
        # Add timestamp to message
        message["timestamp"] = datetime.utcnow().isoformat() + "Z"  # Changed from datetime.now()
        
        # Get copy of connections to avoid modification during iteration
        connections = self.active_connections[channel].copy()
        successful_sends = 0
        failed_sends = 0
        
        for connection in connections:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_text(json.dumps(message))
                    
                    # Update message counter
                    if connection in self.connection_info:
                        self.connection_info[connection]["messages_sent"] += 1
                    
                    successful_sends += 1
                else:
                    # Connection is not active, remove it
                    self.active_connections[channel].discard(connection)
                    if connection in self.connection_info:
                        del self.connection_info[connection]
                    failed_sends += 1
                    
            except WebSocketDisconnect:
                self.disconnect(connection)
                failed_sends += 1
            except Exception as e:
                logger.error(f"Error broadcasting to connection in {channel}: {e}")
                # Remove broken connection
                self.disconnect(connection)
                failed_sends += 1
        
        if failed_sends > 0:
            logger.info(f"Broadcast to {channel}: {successful_sends} successful, {failed_sends} failed")
    
    async def broadcast_monitoring_data(self, protocol_id: str, connection_id: str, metrics: Dict[str, Any]):
        """Broadcast monitoring data to monitoring channel"""
        message = {
            "type": "monitoring_data",
            "data": {
                "protocol_id": protocol_id,
                "connection_id": connection_id,
                "metrics": metrics,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }
        await self.broadcast(message, "monitoring")
    
    async def broadcast_connection_status(self, connection_id: str, status: str, data: Dict[str, Any] = None):
        """Broadcast connection status update"""
        message = {
            "type": "connection_status_update",
            "data": {
                "connection_id": connection_id,
                "status": status,
                "updated_at": datetime.utcnow().isoformat() + "Z",
                **(data or {})
            }
        }
        await self.broadcast(message, "connections")
    
    async def broadcast_log_entry(self, level: str, source: str, message_text: str, metadata: Dict[str, Any] = None):
        """Broadcast log entry to logs channel"""
        message = {
            "type": "log_entry",
            "data": {
                "level": level,
                "source": source,
                "message": message_text,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        }
        await self.broadcast(message, "logs")
    
    async def send_heartbeat(self):
        """Send heartbeat to all connections"""
        heartbeat_message = {
            "type": "heartbeat",
            "data": {
                "server_time": datetime.utcnow().isoformat() + "Z",  # Changed from datetime.now()
                "active_channels": {
                    channel: len(connections) 
                    for channel, connections in self.active_connections.items()
                }
            }
        }
        
        total_sent = 0
        for channel in self.active_connections:
            connections_before = len(self.active_connections[channel])
            await self.broadcast(heartbeat_message, channel)
            total_sent += connections_before
        
        # Update heartbeat timestamp for all connections
        current_time = datetime.utcnow()
        for websocket, info in self.connection_info.items():
            info["last_heartbeat"] = current_time
        
        logger.debug(f"Heartbeat sent to {total_sent} connections across all channels")
    
    async def cleanup_broken_connections(self):
        """Clean up broken WebSocket connections"""
        broken_connections = []
        current_time = datetime.utcnow()
        
        for websocket, info in list(self.connection_info.items()):
            try:
                # Check if connection is stale (no heartbeat response in 5 minutes)
                last_heartbeat = info.get("last_heartbeat", current_time)
                if (current_time - last_heartbeat).total_seconds() > 300:  # 5 minutes
                    broken_connections.append(websocket)
                    continue
                
                # Check connection state
                if websocket.client_state != WebSocketState.CONNECTED:
                    broken_connections.append(websocket)
                    
            except Exception:
                broken_connections.append(websocket)
        
        # Clean up broken connections
        for websocket in broken_connections:
            self.disconnect(websocket)
        
        if broken_connections:
            logger.info(f"Cleaned up {len(broken_connections)} broken WebSocket connections")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        current_time = datetime.utcnow()
        
        stats = {
            "channels": {},
            "total_connections": 0,
            "connection_details": []
        }
        
        for channel, connections in self.active_connections.items():
            stats["channels"][channel] = len(connections)
            stats["total_connections"] += len(connections)
        
        # Add detailed connection info
        for websocket, info in self.connection_info.items():
            connected_duration = (current_time - info["connected_at"]).total_seconds()
            stats["connection_details"].append({
                "channel": info["channel"],
                "connected_at": info["connected_at"].isoformat(),
                "connected_duration_seconds": connected_duration,
                "messages_sent": info["messages_sent"],
                "messages_received": info["messages_received"],
                "client_info": info["client_info"],
                "last_heartbeat": info.get("last_heartbeat", info["connected_at"]).isoformat()
            })
        
        return stats
    
    async def start_heartbeat_task(self, interval: int = 30):
        """Start periodic heartbeat task"""
        logger.info(f"Starting WebSocket heartbeat task with {interval}s interval")
        
        while True:
            try:
                await self.send_heartbeat()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                logger.info("Heartbeat task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in heartbeat task: {e}")
                await asyncio.sleep(interval)
    
    async def start_cleanup_task(self, interval: int = 120):
        """Start periodic cleanup task"""
        logger.info(f"Starting WebSocket cleanup task with {interval}s interval")
        
        while True:
            try:
                await self.cleanup_broken_connections()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                logger.info("Cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
                await asyncio.sleep(interval)
    
    async def start_background_tasks(self):
        """Start all background tasks"""
        if not self.heartbeat_task or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self.start_heartbeat_task())
        
        if not self.cleanup_task or self.cleanup_task.done():
            self.cleanup_task = asyncio.create_task(self.start_cleanup_task())
        
        logger.info("WebSocket background tasks started")
    
    async def stop_background_tasks(self):
        """Stop all background tasks"""
        if self.heartbeat_task and not self.heartbeat_task.done():
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass
        
        if self.cleanup_task and not self.cleanup_task.done():
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        
        logger.info("WebSocket background tasks stopped")

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

# Start background tasks
async def start_websocket_heartbeat():
    """Start the WebSocket background tasks"""
    await websocket_manager.start_background_tasks()
