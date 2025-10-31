from typing import Dict, Any, Optional, List
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
# Reszta kodu...

class ProtocolType(str, Enum):
    MODBUS_TCP = "modbus-tcp"
    OPC_UA = "opc-ua"
    PROFINET = "profinet"
    ETHERNET_IP = "ethernet-ip"
    MQTT = "mqtt"
    CANOPEN = "canopen"
    BACNET = "bacnet"

class ProtocolStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"

class Protocol(Document):
    name: str = Field(..., description="Protocol name")
    type: ProtocolType = Field(..., description="Protocol type")
    description: str = Field("", description="Protocol description")
    status: ProtocolStatus = Field(ProtocolStatus.DISCONNECTED, description="Connection status")
    version: str = Field("1.0", description="Protocol version")
    configuration: Dict[str, Any] = Field(default_factory=dict, description="Protocol configuration")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)  # DODAJ TĘ LINIĘ
    
    class Settings:
        name = "protocols"
        
    def __repr__(self) -> str:
        return f"Protocol(name='{self.name}', type='{self.type}', status='{self.status}')"
