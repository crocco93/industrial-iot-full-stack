from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class MonitoringMetrics(BaseModel):
    bytes_per_second: float = Field(0.0, description="Bytes per second")
    messages_per_second: float = Field(0.0, description="Messages per second")
    error_rate: float = Field(0.0, description="Error rate percentage")
    latency: float = Field(0.0, description="Latency in milliseconds")
    connection_count: int = Field(0, description="Number of active connections")

class MonitoringData(Document):
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Timestamp")
    protocol_id: str = Field(..., description="Associated protocol ID")
    connection_id: Optional[str] = Field(None, description="Associated connection ID")
    metrics: MonitoringMetrics = Field(..., description="Monitoring metrics")
    
    class Settings:
        name = "monitoring_data"
        
    def __repr__(self) -> str:
        return f"MonitoringData(protocol_id='{self.protocol_id}', timestamp='{self.timestamp}')"
