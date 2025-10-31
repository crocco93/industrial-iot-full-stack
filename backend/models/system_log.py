from beanie import Document
from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class LogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class SystemLog(Document):
    level: LogLevel = Field(..., description="Log level")
    source: str = Field(..., description="Log source component")
    message: str = Field(..., description="Log message")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    timestamp: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "systemlogs"
