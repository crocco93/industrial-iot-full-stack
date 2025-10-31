from beanie import Document
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime

class SystemSettings(Document):
    category: str = Field(..., description="Settings category")
    key: str = Field(..., description="Settings key")
    value: Any = Field(..., description="Settings value")
    description: Optional[str] = Field(None, description="Settings description")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "system_settings"
        indexes = [
            [("category", 1), ("key", 1)]  # Compound unique index
            ]

        
    def __repr__(self) -> str:
        return f"SystemSettings(category='{self.category}', key='{self.key}')"
