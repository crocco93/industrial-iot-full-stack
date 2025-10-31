from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ConnectionStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    CONNECTING = "connecting"
    DISCONNECTED = "disconnected"

class ConnectionType(str, Enum):
    MODBUS_TCP = "modbus-tcp"
    OPC_UA = "opc-ua"
    MQTT = "mqtt"
    ETHERNET_IP = "ethernet-ip"
    PROFINET = "profinet"
    CANOPEN = "canopen"
    BACNET = "bacnet"

class Connection(Document):
    """Connection model for industrial protocol connections"""
    
    # Basic Information
    name: str
    description: Optional[str] = None
    protocol_id: str  # Reference to Protocol document
    device_id: Optional[str] = None  # Reference to Device document
    
    # Connection Details
    address: str  # IP address, hostname, or connection string
    port: Optional[int] = None
    status: ConnectionStatus = ConnectionStatus.INACTIVE
    connection_type: ConnectionType
    
    # Configuration
    configuration: Dict[str, Any] = Field(default_factory=dict)
    timeout: Optional[float] = 30.0
    retry_count: int = 3
    retry_interval: float = 5.0
    
    # Connection Statistics
    bytes_sent: int = 0
    bytes_received: int = 0
    bytes_transferred: int = 0
    packets_sent: int = 0
    packets_received: int = 0
    error_count: int = 0
    success_count: int = 0
    
    # Connection Health
    last_seen: Optional[datetime] = None
    last_error: Optional[str] = None
    last_success: Optional[datetime] = None
    uptime_seconds: float = 0.0
    response_time_ms: float = 0.0
    
    # Quality Metrics
    connection_quality: float = 0.0  # 0-100% based on success rate
    data_rate_bps: float = 0.0  # Bytes per second
    latency_ms: float = 0.0
    packet_loss_percent: float = 0.0
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    connected_at: Optional[datetime] = None
    disconnected_at: Optional[datetime] = None
    
    # Security
    encrypted: bool = False
    certificate_id: Optional[str] = None
    
    # Additional metadata
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Settings:
        collection_name = "connections"
        indexes = [
            "protocol_id",
            "device_id", 
            "status",
            "connection_type",
            "address",
            "created_at",
            ["protocol_id", "status"],
            ["device_id", "status"]
        ]
    
    def update_stats(self, bytes_sent: int = 0, bytes_received: int = 0, 
                    packets_sent: int = 0, packets_received: int = 0, 
                    success: bool = True, error_msg: Optional[str] = None):
        """Update connection statistics"""
        self.bytes_sent += bytes_sent
        self.bytes_received += bytes_received
        self.bytes_transferred = self.bytes_sent + self.bytes_received
        self.packets_sent += packets_sent
        self.packets_received += packets_received
        
        if success:
            self.success_count += 1
            self.last_success = datetime.now()
            self.last_seen = datetime.now()
        else:
            self.error_count += 1
            if error_msg:
                self.last_error = error_msg
        
        # Calculate quality metrics
        total_attempts = self.success_count + self.error_count
        if total_attempts > 0:
            self.connection_quality = (self.success_count / total_attempts) * 100
        
        self.updated_at = datetime.now()
    
    def get_uptime(self) -> float:
        """Get connection uptime in seconds"""
        if self.connected_at and self.status == ConnectionStatus.ACTIVE:
            return (datetime.now() - self.connected_at).total_seconds()
        return 0.0
    
    def is_healthy(self) -> bool:
        """Check if connection is healthy"""
        return (
            self.status == ConnectionStatus.ACTIVE and
            self.connection_quality >= 80.0 and
            self.packet_loss_percent < 5.0 and
            (not self.last_seen or 
             (datetime.now() - self.last_seen).total_seconds() < 300)  # Last seen within 5 minutes
        )