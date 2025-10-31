from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class DeviceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    MAINTENANCE = "maintenance"
    PROVISIONING = "provisioning"
    OFFLINE = "offline"
    ONLINE = "online"

class DeviceType(str, Enum):
    INFRASTRUCTURE = "infrastructure"
    PRODUCTION = "production"
    SENSOR = "sensor"
    ACTUATOR = "actuator"
    CONTROLLER = "controller"
    ROBOT = "robot"
    PLC = "plc"
    HMI = "hmi"
    DRIVE = "drive"

class DeviceCategory(str, Enum):
    POWER_METER = "power_meter"
    TEMPERATURE_SENSOR = "temperature_sensor"
    PRESSURE_SENSOR = "pressure_sensor"
    FLOW_SENSOR = "flow_sensor"
    LEVEL_SENSOR = "level_sensor"
    VIBRATION_SENSOR = "vibration_sensor"
    PLC_CONTROLLER = "plc_controller"
    MOTOR_DRIVE = "motor_drive"
    ROBOT_ARM = "robot_arm"
    CONVEYOR = "conveyor"
    PACKAGING_MACHINE = "packaging_machine"
    QUALITY_SCANNER = "quality_scanner"

class Device(Document):
    """Device model representing industrial equipment and sensors"""
    
    # Basic Information
    name: str
    description: Optional[str] = None
    device_type: DeviceType = DeviceType.PRODUCTION
    category: Optional[DeviceCategory] = None
    
    # Hierarchical Structure
    location_id: Optional[str] = None  # Reference to Location
    area_id: Optional[str] = None      # Reference to Area
    parent_device_id: Optional[str] = None  # For sub-devices
    
    # Protocol Connection
    protocol_id: Optional[str] = None  # Reference to Protocol document
    connection_id: Optional[str] = None  # Reference to Connection document
    
    # Device Identification
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    
    # Network Configuration
    address: Optional[str] = None  # IP address or network identifier
    port: Optional[int] = None
    unit_id: Optional[int] = None  # Modbus unit ID, OPC-UA node ID, etc.
    device_id: Optional[int] = None  # Protocol-specific device ID
    
    # Device Status
    status: DeviceStatus = DeviceStatus.INACTIVE
    online: bool = False
    last_seen: Optional[datetime] = None
    last_error: Optional[str] = None
    last_success: Optional[datetime] = None
    
    # Communication Settings
    read_frequency: int = 1000  # milliseconds
    timeout: float = 5.0  # seconds
    retry_count: int = 3
    polling_enabled: bool = True
    
    # Configuration
    configuration: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Statistics
    total_reads: int = 0
    successful_reads: int = 0
    failed_reads: int = 0
    bytes_transferred: int = 0
    average_response_time: float = 0.0
    
    # Quality Metrics
    availability_percent: float = 0.0
    reliability_percent: float = 0.0
    data_quality_score: float = 0.0
    
    # Physical Properties (for sensors)
    measurement_unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    precision: Optional[int] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    
    # Security
    encrypted: bool = False
    certificate_id: Optional[str] = None
    access_level: str = "read"  # read, write, admin
    
    class Settings:
        collection_name = "devices"
        indexes = [
            "protocol_id",
            "connection_id",
            "location_id",
            "area_id",
            "device_type",
            "category",
            "status",
            "address",
            "created_at",
            ["location_id", "area_id"],
            ["protocol_id", "status"],
            ["device_type", "status"]
        ]
    
    def update_stats(self, success: bool, response_time: float = 0.0, bytes_count: int = 0, error_msg: Optional[str] = None):
        """Update device statistics"""
        self.total_reads += 1
        
        if success:
            self.successful_reads += 1
            self.last_success = datetime.utcnow()
            self.last_seen = datetime.utcnow()
            self.online = True
            self.status = DeviceStatus.ACTIVE if self.status != DeviceStatus.MAINTENANCE else DeviceStatus.MAINTENANCE
        else:
            self.failed_reads += 1
            if error_msg:
                self.last_error = error_msg
            self.online = False
            if self.status not in [DeviceStatus.MAINTENANCE, DeviceStatus.PROVISIONING]:
                self.status = DeviceStatus.ERROR
        
        self.bytes_transferred += bytes_count
        
        # Update response time (rolling average)
        if response_time > 0:
            self.average_response_time = (
                (self.average_response_time * (self.total_reads - 1) + response_time) / self.total_reads
            )
        
        # Calculate quality metrics
        if self.total_reads > 0:
            self.reliability_percent = (self.successful_reads / self.total_reads) * 100
        
        self.updated_at = datetime.utcnow()
    
    def calculate_availability(self, period_hours: int = 24) -> float:
        """Calculate device availability over specified period"""
        if not self.last_seen:
            return 0.0
        
        time_since_seen = (datetime.utcnow() - self.last_seen).total_seconds() / 3600
        if time_since_seen > period_hours:
            return 0.0
        
        uptime_percent = max(0, 100 - (time_since_seen / period_hours * 100))
        return min(100, uptime_percent)
    
    def is_healthy(self) -> bool:
        """Check if device is considered healthy"""
        return (
            self.status in [DeviceStatus.ACTIVE, DeviceStatus.ONLINE] and
            self.online and
            self.reliability_percent >= 95.0 and
            (not self.last_seen or 
             (datetime.utcnow() - self.last_seen).total_seconds() < 300)  # Last seen within 5 minutes
        )
    
    def get_display_name(self) -> str:
        """Get formatted display name for UI"""
        if self.vendor and self.model:
            return f"{self.name} ({self.vendor} {self.model})"
        return self.name
    
    def to_tree_node(self) -> Dict[str, Any]:
        """Convert device to tree node structure for hierarchical display"""
        return {
            "id": str(self.id),
            "name": self.name,
            "type": "device",
            "device_type": self.device_type,
            "category": self.category,
            "status": self.status,
            "online": self.online,
            "children": [],  # Data points will be added separately
            "metadata": {
                "vendor": self.vendor,
                "model": self.model,
                "address": self.address,
                "last_seen": self.last_seen.isoformat() if self.last_seen else None,
                "reliability": self.reliability_percent
            }
        }