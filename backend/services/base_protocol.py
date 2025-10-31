from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio
import logging
from datetime import datetime
import random

logger = logging.getLogger(__name__)

class BaseProtocolService(ABC):
    """Base class for all industrial protocol services"""
    
    def __init__(self, protocol_type: str):
        self.protocol_type = protocol_type
        self.active_connections: Dict[str, Dict] = {}
        self.is_running = False
        self.monitoring_task: Optional[asyncio.Task] = None
        logger.info(f"Initialized {protocol_type} protocol service")
    
    @abstractmethod
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start the protocol service with given configuration"""
        pass
    
    @abstractmethod
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop the protocol service"""
        pass
    
    @abstractmethod
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test connection to a device"""
        pass
    
    @abstractmethod
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read data from a specific data point"""
        pass
    
    @abstractmethod
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write data to a specific data point"""
        pass
    
    async def start_monitoring(self):
        """Start monitoring task for real-time data generation"""
        if not self.monitoring_task or self.monitoring_task.done():
            self.is_running = True
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
            logger.info(f"Started monitoring for {self.protocol_type}")
    
    async def stop_monitoring(self):
        """Stop monitoring task"""
        self.is_running = False
        if self.monitoring_task and not self.monitoring_task.done():
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info(f"Stopped monitoring for {self.protocol_type}")
    
    async def _monitoring_loop(self):
        """Internal monitoring loop - generates real-time data"""
        while self.is_running:
            try:
                await self._generate_monitoring_data()
                await asyncio.sleep(1)  # Generate data every second
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop for {self.protocol_type}: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _generate_monitoring_data(self):
        """Generate monitoring data for active connections"""
        if not self.active_connections:
            return
        
        for protocol_id, connection_info in self.active_connections.items():
            try:
                # Generate realistic metrics based on connection status
                connection_count = len(self.active_connections)
                base_throughput = connection_info.get('base_throughput', 1000)
                
                metrics = {
                    "bytes_per_second": random.uniform(base_throughput * 0.1, base_throughput * 2.0),
                    "messages_per_second": random.uniform(10, 100),
                    "error_rate": random.uniform(0, 0.05),  # 0-5% error rate
                    "latency": random.uniform(5, 50),  # 5-50ms latency
                    "connection_count": connection_count
                }
                
                # Store monitoring data in database
                await self._store_monitoring_data(protocol_id, metrics)
                
                # Broadcast via WebSocket
                await self._broadcast_monitoring_data(protocol_id, None, metrics)
                
            except Exception as e:
                logger.error(f"Error generating monitoring data for {protocol_id}: {e}")
    
    async def _store_monitoring_data(self, protocol_id: str, metrics: Dict):
        """Store monitoring data in database - using lazy import to avoid circular imports"""
        try:
            # Lazy import to avoid circular imports
            from models.monitoring import MonitoringData, MonitoringMetrics
            
            monitoring_data = MonitoringData(
                protocol_id=protocol_id,
                metrics=MonitoringMetrics(**metrics),
                timestamp=datetime.utcnow()
            )
            await monitoring_data.insert()
            
        except Exception as e:
            logger.error(f"Error storing monitoring data for {protocol_id}: {e}")
    
    async def _broadcast_monitoring_data(self, protocol_id: str, connection_id: Optional[str], metrics: Dict):
        """Broadcast monitoring data via WebSocket - using lazy import to avoid circular imports"""
        try:
            # Lazy import to avoid circular imports
            from services.websocket_manager import websocket_manager
            await websocket_manager.broadcast_monitoring_data(protocol_id, connection_id or protocol_id, metrics)
            
        except Exception as e:
            logger.error(f"Error broadcasting monitoring data for {protocol_id}: {e}")
    
    async def _log_protocol_event(self, protocol_id: str, level: str, message: str, metadata: Dict = None):
        """Log protocol events - using lazy import to avoid circular imports"""
        try:
            # Lazy import to avoid circular imports
            from models.system_log import SystemLog, LogLevel
            
            log = SystemLog(
                level=LogLevel(level),
                source=f"protocol.{self.protocol_type}.{protocol_id}",
                message=message,
                metadata=metadata or {},
                timestamp=datetime.utcnow()
            )
            await log.insert()
            
            # Broadcast log entry
            from services.websocket_manager import websocket_manager
            await websocket_manager.broadcast_log_entry(level, f"protocol.{self.protocol_type}.{protocol_id}", message, metadata)
            
        except Exception as e:
            logger.error(f"Error logging protocol event for {protocol_id}: {e}")
    
    def generate_mock_value(self, data_type: str) -> Any:
        """Generate mock values based on data type for testing purposes"""
        if data_type == "boolean":
            return random.choice([True, False])
        elif data_type == "integer":
            return random.randint(0, 1000)
        elif data_type == "float":
            return round(random.uniform(0.0, 1000.0), 2)
        elif data_type == "string":
            return f"mock_value_{random.randint(1000, 9999)}"
        elif data_type == "binary":
            return bytes([random.randint(0, 255) for _ in range(8)])
        else:
            return None
    
    async def get_connection_info(self, protocol_id: str) -> Optional[Dict[str, Any]]:
        """Get connection information for a specific protocol"""
        return self.active_connections.get(protocol_id)
    
    async def update_connection_status(self, protocol_id: str, status: str, additional_info: Dict[str, Any] = None):
        """Update connection status and broadcast changes"""
        if protocol_id in self.active_connections:
            self.active_connections[protocol_id].update({
                "status": status,
                "last_updated": datetime.utcnow(),
                **(additional_info or {})
            })
            
            # Broadcast connection status update
            try:
                from services.websocket_manager import websocket_manager
                await websocket_manager.broadcast_connection_status(
                    protocol_id, 
                    status, 
                    self.active_connections[protocol_id]
                )
            except Exception as e:
                logger.error(f"Error broadcasting connection status update: {e}")
    
    def get_service_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            "protocol_type": self.protocol_type,
            "is_running": self.is_running,
            "active_connections": len(self.active_connections),
            "monitoring_active": self.monitoring_task is not None and not self.monitoring_task.done(),
            "connection_details": {
                conn_id: {
                    "status": info.get("status", "unknown"),
                    "last_updated": info.get("last_updated", datetime.utcnow()).isoformat() if info.get("last_updated") else None
                }
                for conn_id, info in self.active_connections.items()
            }
        }
