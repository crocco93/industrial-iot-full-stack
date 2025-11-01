from beanie import Document
from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    MUTED = "muted"

class Alert(Document):
    """
    Alert model for monitoring and notification system
    """
    
    # Core fields
    title: str = Field(description="Alert title/summary")
    description: str = Field(description="Detailed alert description")
    severity: AlertSeverity = Field(description="Alert severity level")
    status: AlertStatus = Field(default=AlertStatus.ACTIVE, description="Current alert status")
    
    # Source information
    source: str = Field(description="Source identifier (device_id, protocol_id, system)")
    source_type: str = Field(description="Type of source (device, protocol, system, data_point)")
    source_name: str = Field(description="Human-readable source name")
    category: str = Field(description="Alert category (connection, threshold, system, security)")
    
    # Related entities
    data_point_id: Optional[str] = Field(default=None, description="Related data point ID")
    device_id: Optional[str] = Field(default=None, description="Related device ID")
    protocol_id: Optional[str] = Field(default=None, description="Related protocol ID")
    connection_id: Optional[str] = Field(default=None, description="Related connection ID")
    
    # Threshold information (for threshold-based alerts)
    threshold_value: Optional[float] = Field(default=None, description="Threshold value that was exceeded")
    current_value: Optional[float] = Field(default=None, description="Current value that triggered alert")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = Field(default=None)
    resolved_at: Optional[datetime] = Field(default=None)
    muted_until: Optional[datetime] = Field(default=None)
    
    # User tracking
    acknowledged_by: Optional[str] = Field(default=None, description="User who acknowledged the alert")
    resolved_by: Optional[str] = Field(default=None, description="User who resolved the alert")
    
    # Notifications
    notification_sent: bool = Field(default=False, description="Whether notification was sent")
    notification_channels: List[str] = Field(default=[], description="Channels where notification was sent")
    
    # Additional data
    metadata: Dict[str, Any] = Field(default={}, description="Additional alert metadata")
    
    # Configuration
    auto_resolve: bool = Field(default=False, description="Whether alert should auto-resolve")
    auto_resolve_after: Optional[int] = Field(default=None, description="Auto-resolve after N minutes")
    
    class Settings:
        name = "alerts"
        indexes = [
            "severity",
            "status", 
            "source_type",
            "category",
            "created_at",
            "device_id",
            "data_point_id",
            "protocol_id",
            ["status", "severity"],  # Compound index
            ["created_at", "severity"]  # Compound index
        ]
    
    def __str__(self):
        return f"Alert({self.title}, {self.severity}, {self.status})"
    
    @property
    def is_active(self) -> bool:
        """Check if alert is currently active"""
        return self.status == AlertStatus.ACTIVE
    
    @property
    def is_muted(self) -> bool:
        """Check if alert is currently muted"""
        if self.status != AlertStatus.MUTED:
            return False
        if self.muted_until and self.muted_until < datetime.utcnow():
            return False
        return True
    
    @property
    def time_since_created(self) -> str:
        """Get human-readable time since alert was created"""
        diff = datetime.utcnow() - self.created_at
        
        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"
    
    def acknowledge(self, acknowledged_by: str):
        """Acknowledge the alert"""
        self.status = AlertStatus.ACKNOWLEDGED
        self.acknowledged_at = datetime.utcnow()
        self.acknowledged_by = acknowledged_by
        self.updated_at = datetime.utcnow()
    
    def resolve(self, resolved_by: str):
        """Resolve the alert"""
        self.status = AlertStatus.RESOLVED
        self.resolved_at = datetime.utcnow()
        self.resolved_by = resolved_by
        self.updated_at = datetime.utcnow()
    
    def mute(self, duration_hours: int = 1):
        """Mute the alert for specified duration"""
        self.status = AlertStatus.MUTED
        self.muted_until = datetime.utcnow() + timedelta(hours=duration_hours)
        self.updated_at = datetime.utcnow()
    
    def to_websocket_message(self) -> Dict[str, Any]:
        """Convert alert to WebSocket message format"""
        return {
            "type": "alert",
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "source_name": self.source_name,
            "category": self.category,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata
        }

# Alert templates for common alert types
COMMON_ALERT_TEMPLATES = {
    "device_offline": {
        "title": "Device Offline",
        "description": "Device {device_name} is not responding",
        "severity": AlertSeverity.HIGH,
        "category": "connection",
        "source_type": "device"
    },
    "threshold_exceeded": {
        "title": "Threshold Exceeded", 
        "description": "Data point {data_point_name} value ({current_value}) exceeds threshold ({threshold_value})",
        "severity": AlertSeverity.MEDIUM,
        "category": "threshold",
        "source_type": "data_point"
    },
    "protocol_error": {
        "title": "Protocol Error",
        "description": "Protocol {protocol_name} encountered an error: {error_message}",
        "severity": AlertSeverity.HIGH,
        "category": "connection", 
        "source_type": "protocol"
    },
    "system_resource": {
        "title": "System Resource Alert",
        "description": "System {resource_type} usage is {current_value}% (threshold: {threshold_value}%)",
        "severity": AlertSeverity.MEDIUM,
        "category": "system",
        "source_type": "system"
    },
    "security_breach": {
        "title": "Security Alert",
        "description": "Security event detected: {event_description}",
        "severity": AlertSeverity.CRITICAL,
        "category": "security",
        "source_type": "system"
    }
}

def create_alert_from_template(template_name: str, **kwargs) -> Alert:
    """Create alert from predefined template with parameter substitution"""
    if template_name not in COMMON_ALERT_TEMPLATES:
        raise ValueError(f"Unknown alert template: {template_name}")
    
    template = COMMON_ALERT_TEMPLATES[template_name].copy()
    
    # Substitute parameters in title and description
    if kwargs:
        template["title"] = template["title"].format(**kwargs)
        template["description"] = template["description"].format(**kwargs)
    
    return Alert(
        **template,
        source=kwargs.get("source", "unknown"),
        source_name=kwargs.get("source_name", "Unknown Source"),
        metadata=kwargs.get("metadata", {})
    )