from beanie import Document
from pydantic import Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class LocationType(str, Enum):
    LOCATION = "location"  # Factory, Plant, Site
    AREA = "area"         # Production Floor, Workshop, Zone

class LocationStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"

class Location(Document):
    """
    Location model for hierarchical organization structure
    Supports: Factory → Areas → Devices → Data Points
    """
    
    # Core identification
    name: str = Field(description="Location/area name")
    description: str = Field(default="", description="Location description")
    type: LocationType = Field(description="Location type (location or area)")
    
    # Hierarchy
    parent_id: Optional[str] = Field(default=None, description="Parent location ID")
    path: str = Field(default="", description="Full hierarchical path")
    level: int = Field(default=0, description="Hierarchy level (0=root)")
    
    # Physical information
    address: Optional[str] = Field(default="", description="Physical address")
    coordinates: Optional[Dict[str, float]] = Field(default=None, description="GPS coordinates {lat, lng}")
    floor_number: Optional[int] = Field(default=None, description="Floor number in building")
    room_number: Optional[str] = Field(default=None, description="Room/area identifier")
    
    # Status and organization
    status: LocationStatus = Field(default=LocationStatus.ACTIVE)
    order_index: int = Field(default=0, description="Display order within parent")
    
    # Operational information
    manager: Optional[str] = Field(default=None, description="Manager/responsible person")
    contact_info: Dict[str, str] = Field(default={}, description="Contact information")
    operating_hours: Optional[Dict[str, str]] = Field(default=None, description="Operating schedule")
    
    # Technical metadata
    network_segment: Optional[str] = Field(default=None, description="Network segment/VLAN")
    safety_zone: Optional[str] = Field(default=None, description="Safety classification")
    environmental_conditions: Dict[str, Any] = Field(default={}, description="Environmental data")
    
    # Relationships (computed fields)
    device_count: int = Field(default=0, description="Number of devices in this location")
    active_device_count: int = Field(default=0, description="Number of active devices")
    alert_count: int = Field(default=0, description="Number of active alerts")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: Optional[datetime] = Field(default=None, description="Last device activity")
    
    # Additional metadata
    metadata: Dict[str, Any] = Field(default={}, description="Additional custom data")
    tags: List[str] = Field(default=[], description="Searchable tags")
    
    class Settings:
        name = "locations"
        indexes = [
            "name",
            "type",
            "parent_id",
            "status",
            "path",
            "level",
            "order_index",
            ["parent_id", "order_index"],  # Compound index for hierarchy
            ["type", "status"],            # Compound index for filtering
            ["path", "level"]               # Compound index for tree queries
        ]
    
    def __str__(self):
        return f"Location({self.name}, {self.type}, level={self.level})"
    
    @property
    def full_path(self) -> str:
        """Get full hierarchical path"""
        return self.path or self.name
    
    @property
    def is_root(self) -> bool:
        """Check if this is a root location"""
        return self.parent_id is None
    
    @property
    def is_active(self) -> bool:
        """Check if location is active"""
        return self.status == LocationStatus.ACTIVE
    
    def update_path(self, parent_path: str = ""):
        """Update the full path based on parent path"""
        if parent_path:
            self.path = f"{parent_path} > {self.name}"
        else:
            self.path = self.name
    
    def update_level(self, parent_level: int = -1):
        """Update hierarchy level"""
        self.level = parent_level + 1
    
    async def get_children(self) -> List['Location']:
        """Get direct children of this location"""
        return await Location.find(
            Location.parent_id == str(self.id),
            Location.status == LocationStatus.ACTIVE
        ).sort(Location.order_index).to_list()
    
    async def get_all_descendants(self) -> List['Location']:
        """Get all descendants (children, grandchildren, etc.)"""
        descendants = []
        children = await self.get_children()
        
        for child in children:
            descendants.append(child)
            child_descendants = await child.get_all_descendants()
            descendants.extend(child_descendants)
        
        return descendants
    
    async def get_device_count(self) -> Dict[str, int]:
        """Get device statistics for this location"""
        try:
            from models.device import Device
            
            # Count devices directly in this location
            direct_devices = await Device.find(
                Device.location_id == str(self.id)
            ).count()
            
            # Count devices in all child locations
            descendants = await self.get_all_descendants()
            descendant_ids = [str(d.id) for d in descendants]
            
            child_devices = 0
            if descendant_ids:
                child_devices = await Device.find(
                    {"location_id": {"$in": descendant_ids}}
                ).count()
            
            active_devices = await Device.find(
                {"$or": [
                    {"location_id": str(self.id)},
                    {"location_id": {"$in": descendant_ids}}
                ]},
                Device.status == "active"
            ).count()
            
            return {
                "direct_devices": direct_devices,
                "total_devices": direct_devices + child_devices,
                "active_devices": active_devices,
                "inactive_devices": (direct_devices + child_devices) - active_devices
            }
            
        except Exception as e:
            print(f"Error getting device count: {e}")
            return {
                "direct_devices": 0,
                "total_devices": 0,
                "active_devices": 0,
                "inactive_devices": 0
            }
    
    async def update_counters(self):
        """Update device and alert counters"""
        try:
            device_stats = await self.get_device_count()
            self.device_count = device_stats["total_devices"]
            self.active_device_count = device_stats["active_devices"]
            
            # Update alert count
            try:
                from models.alert import Alert
                self.alert_count = await Alert.find(
                    Alert.source == str(self.id),
                    Alert.status.in_(["active", "acknowledged"])
                ).count()
            except Exception:
                self.alert_count = 0
            
            self.updated_at = datetime.utcnow()
            await self.save()
            
        except Exception as e:
            print(f"Error updating counters for location {self.name}: {e}")
    
    def to_tree_node(self) -> Dict[str, Any]:
        """Convert to tree node format for frontend"""
        return {
            "id": str(self.id),
            "name": self.name,
            "type": "location" if self.type == LocationType.LOCATION else "area",
            "description": self.description,
            "parent_id": self.parent_id,
            "status": self.status,
            "order_index": self.order_index,
            "device_count": self.device_count,
            "active_device_count": self.active_device_count,
            "alert_count": self.alert_count,
            "metadata": {
                **self.metadata,
                "address": self.address,
                "coordinates": self.coordinates,
                "manager": self.manager,
                "last_activity": self.last_activity.isoformat() if self.last_activity else None
            },
            "children": []  # Will be populated by tree builder
        }

# Location hierarchy utilities
async def build_location_hierarchy() -> List[Dict[str, Any]]:
    """Build complete location hierarchy tree"""
    try:
        # Get all active locations
        locations = await Location.find(
            Location.status == LocationStatus.ACTIVE
        ).sort(Location.level, Location.order_index).to_list()
        
        # Convert to tree nodes
        nodes = {str(loc.id): loc.to_tree_node() for loc in locations}
        tree = []
        
        # Build tree structure
        for loc in locations:
            node = nodes[str(loc.id)]
            
            if loc.parent_id is None:
                # Root node
                tree.append(node)
            else:
                # Child node - add to parent
                parent_id = str(loc.parent_id)
                if parent_id in nodes:
                    nodes[parent_id]["children"].append(node)
        
        return tree
        
    except Exception as e:
        print(f"Error building location hierarchy: {e}")
        return []

async def update_location_paths():
    """Update all location paths in the database"""
    try:
        locations = await Location.find(
            Location.status == LocationStatus.ACTIVE
        ).sort(Location.level).to_list()
        
        # Update paths level by level
        for location in locations:
            if location.parent_id:
                parent = await Location.get(location.parent_id)
                if parent:
                    location.update_path(parent.path)
                    location.update_level(parent.level)
            else:
                location.update_path()
                location.update_level()
            
            await location.save()
        
    except Exception as e:
        print(f"Error updating location paths: {e}")