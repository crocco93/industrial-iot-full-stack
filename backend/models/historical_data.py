from beanie import Document
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime
from enum import Enum

class DataQuality(str, Enum):
    GOOD = "good"
    BAD = "bad"
    UNCERTAIN = "uncertain"

class HistoricalData(Document):
    data_point_id: str = Field(..., description="Associated data point ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Data timestamp")
    value: Any = Field(..., description="Data value")
    quality: DataQuality = Field(DataQuality.GOOD, description="Data quality")
    source: Optional[str] = Field(None, description="Data source")
    
    class Settings:
        name = "historical_data"
        indexes = [
            [("data_point_id", 1), ("timestamp", -1)]  # Compound index for efficient queries
        ]

    def __repr__(self) -> str:
        return f"HistoricalData(data_point_id='{self.data_point_id}', quality='{self.quality}')"
