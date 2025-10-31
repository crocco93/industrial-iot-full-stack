from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class CertificateType(str, Enum):
    CLIENT = "client"
    SERVER = "server"
    CA = "ca"

class CertificateStatus(str, Enum):
    VALID = "valid"
    EXPIRED = "expired"
    REVOKED = "revoked"

class Certificate(Document):
    name: str = Field(..., description="Certificate name")
    type: CertificateType = Field(..., description="Certificate type")
    status: CertificateStatus = Field(CertificateStatus.VALID, description="Certificate status")
    subject: str = Field("", description="Certificate subject")
    issuer: str = Field("", description="Certificate issuer")
    valid_from: Optional[datetime] = Field(None, description="Valid from date")
    valid_to: Optional[datetime] = Field(None, description="Valid to date")
    fingerprint: str = Field("", description="Certificate fingerprint")
    certificate_data: Optional[str] = Field(None, description="PEM certificate data")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)  # DODAJ TĘ LINIĘ

    
    class Settings:
        name = "certificates"
        
    def __repr__(self) -> str:
        return f"Certificate(name='{self.name}', type='{self.type}', status='{self.status}')"
