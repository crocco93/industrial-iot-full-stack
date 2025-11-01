from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from database.mongodb import get_database
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class LocationModel(BaseModel):
    id: Optional[str] = None
    name: str = Field(description="Location name")
    description: Optional[str] = Field(default="", description="Location description")
    type: str = Field(description="Location type: location, area, device, data_point")
    parent_id: Optional[str] = Field(default=None, description="Parent location ID")
    address: Optional[str] = Field(default="", description="Physical address")
    coordinates: Optional[Dict[str, float]] = Field(default=None, description="GPS coordinates")
    metadata: Dict[str, Any] = Field(default={}, description="Additional metadata")
    status: str = Field(default="active", description="Status: active, inactive")
    order_index: int = Field(default=0, description="Order in parent")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LocationCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    type: str  # location, area
    parent_id: Optional[str] = None
    address: Optional[str] = ""
    coordinates: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = {}
    order_index: int = 0

class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    address: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    order_index: Optional[int] = None

class LocationMoveRequest(BaseModel):
    new_parent_id: Optional[str]
    new_order_index: int

# In-memory storage for development
locations_storage: Dict[str, LocationModel] = {}

def create_sample_locations() -> List[LocationModel]:
    """Create sample location hierarchy for development"""
    now = datetime.utcnow()
    
    locations = [
        # Root locations
        LocationModel(
            id="loc_factory_001",
            name="Main Factory",
            description="Primary manufacturing facility",
            type="location",
            parent_id=None,
            address="Industrial District, Warsaw",
            coordinates={"lat": 52.2297, "lng": 21.0122},
            metadata={"capacity": 1000, "employees": 45},
            order_index=0,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="loc_warehouse_001",
            name="Warehouse Complex",
            description="Storage and logistics center",
            type="location",
            parent_id=None,
            address="Logistics Park, Warsaw",
            coordinates={"lat": 52.1500, "lng": 21.0000},
            metadata={"area_sqm": 5000, "capacity_tons": 200},
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        
        # Areas in Main Factory
        LocationModel(
            id="area_production_001",
            name="Production Floor A",
            description="Main production line - Assembly",
            type="area",
            parent_id="loc_factory_001",
            metadata={"line_speed": "120 units/hour", "shift_workers": 12},
            order_index=0,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_production_002",
            name="Production Floor B",
            description="Secondary production line - Packaging",
            type="area",
            parent_id="loc_factory_001",
            metadata={"line_speed": "90 units/hour", "shift_workers": 8},
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_quality_001",
            name="Quality Control Lab",
            description="Quality assurance and testing laboratory",
            type="area",
            parent_id="loc_factory_001",
            metadata={"test_capacity": "50 samples/day", "certification": "ISO 9001"},
            order_index=2,
            created_at=now,
            updated_at=now
        )
    ]
    
    return locations

@router.get("/locations", response_model=List[LocationModel])
async def get_locations(
    parent_id: Optional[str] = None,
    type: Optional[str] = None,
    flatten: bool = Query(False, description="Return flat list instead of tree")
):
    """Get locations with optional filtering"""
    try:
        # Initialize sample data if empty
        if not locations_storage:
            sample_locations = create_sample_locations()
            for loc in sample_locations:
                locations_storage[loc.id] = loc
            logger.info(f"Initialized {len(sample_locations)} sample locations")
        
        # Filter locations
        filtered_locations = list(locations_storage.values())
        
        if parent_id is not None:
            filtered_locations = [loc for loc in filtered_locations if loc.parent_id == parent_id]
        if type:
            filtered_locations = [loc for loc in filtered_locations if loc.type == type]
        
        # Sort by order_index
        filtered_locations.sort(key=lambda x: x.order_index)
        
        return filtered_locations
        
    except Exception as e:
        logger.error(f"Failed to get locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/tree")
async def get_location_tree():
    """Get complete location hierarchy as tree"""
    try:
        locations = await get_locations()
        
        def build_tree(locations: List[LocationModel]) -> List[Dict[str, Any]]:
            # Convert to dict
            location_map = {loc.id: loc.dict() for loc in locations}
            
            # Add children arrays
            for loc_dict in location_map.values():
                loc_dict["children"] = []
            
            tree = []
            
            # Build hierarchy
            for loc in locations:
                if loc.parent_id is None:
                    tree.append(location_map[loc.id])
                else:
                    if loc.parent_id in location_map:
                        location_map[loc.parent_id]["children"].append(location_map[loc.id])
            
            return tree
        
        return build_tree(locations)
        
    except Exception as e:
        logger.error(f"Failed to get location tree: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/{location_id}", response_model=LocationModel)
async def get_location(location_id: str):
    """Get specific location by ID"""
    try:
        if location_id in locations_storage:
            return locations_storage[location_id]
        
        raise HTTPException(status_code=404, detail="Location not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/locations", response_model=LocationModel)
async def create_location(location_data: LocationCreateRequest):
    """Create new location or area"""
    try:
        location = LocationModel(
            id=f"loc_{int(datetime.utcnow().timestamp())}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **location_data.dict()
        )
        
        locations_storage[location.id] = location
        logger.info(f"Created location: {location.name}")
        
        return location
        
    except Exception as e:
        logger.error(f"Failed to create location: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/locations/{location_id}", response_model=LocationModel)
async def update_location(location_id: str, update_data: LocationUpdateRequest):
    """Update existing location"""
    try:
        if location_id not in locations_storage:
            raise HTTPException(status_code=404, detail="Location not found")
        
        existing_location = locations_storage[location_id]
        update_dict = update_data.dict(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        for key, value in update_dict.items():
            setattr(existing_location, key, value)
        
        locations_storage[location_id] = existing_location
        logger.info(f"Updated location {location_id}")
        
        return existing_location
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/locations/{location_id}")
async def delete_location(location_id: str):
    """Delete location and all its children"""
    try:
        if location_id not in locations_storage:
            raise HTTPException(status_code=404, detail="Location not found")
        
        deleted_count = 0
        
        def delete_recursive(loc_id: str) -> int:
            """Recursively delete location and children"""
            count = 0
            
            # Find children first
            children = [loc.id for loc in locations_storage.values() if loc.parent_id == loc_id]
            
            # Delete children recursively
            for child_id in children:
                if child_id in locations_storage:
                    count += delete_recursive(child_id)
            
            # Delete the location itself
            if loc_id in locations_storage:
                location_name = locations_storage[loc_id].name
                del locations_storage[loc_id]
                count += 1
                logger.info(f"Deleted location {loc_id} ({location_name})")
            
            return count
        
        deleted_count = delete_recursive(location_id)
        
        return {
            "success": True,
            "message": f"Usunięto lokację i {deleted_count - 1} dzieci",
            "deleted_count": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/locations/{location_id}/move")
async def move_location(location_id: str, move_data: LocationMoveRequest):
    """Move location to new parent with new order"""
    try:
        # Validate that location exists
        if location_id not in locations_storage:
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Validate that new parent exists (if specified)
        if move_data.new_parent_id and move_data.new_parent_id not in locations_storage:
            raise HTTPException(status_code=404, detail="Parent location not found")
        
        # Update location
        location = locations_storage[location_id]
        location.parent_id = move_data.new_parent_id
        location.order_index = move_data.new_order_index
        location.updated_at = datetime.utcnow()
        
        locations_storage[location_id] = location
        
        return {
            "success": True,
            "message": "Location moved successfully",
            "location": location
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to move location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/stats")
async def get_location_stats():
    """Get location statistics"""
    try:
        # Initialize sample data if empty
        if not locations_storage:
            sample_locations = create_sample_locations()
            for loc in sample_locations:
                locations_storage[loc.id] = loc
        
        all_locations = list(locations_storage.values())
        
        stats = {
            "total": len(all_locations),
            "locations": len([loc for loc in all_locations if loc.type == "location"]),
            "areas": len([loc for loc in all_locations if loc.type == "area"]),
            "active": len([loc for loc in all_locations if loc.status == "active"]),
            "inactive": len([loc for loc in all_locations if loc.status == "inactive"]),
            "by_type": {}
        }
        
        # Count by type
        for loc in all_locations:
            loc_type = loc.type
            stats["by_type"][loc_type] = stats["by_type"].get(loc_type, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get location stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))