from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DataType(str, Enum):
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"

class DataPoint(Document):
    name: str = Field(..., description="Data point name")
    description: str = Field("", description="Data point description")
    device_id: str = Field(..., description="Associated device ID")
    data_type: DataType = Field(DataType.INTEGER, description="Data type")
    address: str = Field(..., description="Data point address/identifier")
    unit: Optional[str] = Field(None, description="Unit of measurement")
    scaling_factor: float = Field(1.0, description="Scaling factor")
    offset: float = Field(0.0, description="Offset value")
    limits: Dict[str, float] = Field(default_factory=dict, description="Min/max limits")
    enabled: bool = Field(True, description="Whether data point is enabled")
    configuration: Dict[str, Any] = Field(default_factory=dict, description="Protocol-specific configuration")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "datapoints"

    def __repr__(self) -> str:
        return f"<DataPoint {self.name} ({self.address})>"
