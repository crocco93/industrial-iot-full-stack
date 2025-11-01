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

# In-memory storage for development (would be MongoDB in production)
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
        ),
        LocationModel(
            id="area_utilities_001",
            name="Utilities & HVAC",
            description="Power distribution, water, and HVAC systems",
            type="area",
            parent_id="loc_factory_001",
            metadata={"power_capacity": "500kW", "backup_generator": True},
            order_index=3,
            created_at=now,
            updated_at=now
        ),
        
        # Areas in Warehouse
        LocationModel(
            id="area_receiving_001",
            name="Receiving Bay",
            description="Incoming goods reception and inspection",
            type="area",
            parent_id="loc_warehouse_001",
            metadata={"dock_doors": 4, "max_truck_size": "40ft"},
            order_index=0,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_storage_001",
            name="Main Storage Hall",
            description="Primary storage area with automated systems",
            type="area",
            parent_id="loc_warehouse_001",
            metadata={"rack_levels": 6, "automated_retrieval": True},
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_shipping_001",
            name="Shipping & Dispatch",
            description="Outgoing goods preparation and dispatch",
            type="area",
            parent_id="loc_warehouse_001",
            metadata={"loading_docks": 6, "daily_shipments": 150},
            order_index=2,
            created_at=now,
            updated_at=now
        )
    ]
    
    return locations

def build_location_tree(locations: List[LocationModel]) -> List[Dict[str, Any]]:
    """Build hierarchical tree from flat list"""
    location_dict = {loc.id: loc.dict() for loc in locations}
    tree = []
    
    # First pass: add root locations
    for loc in locations:
        if loc.parent_id is None:
            node = loc.dict()
            node["children"] = []
            tree.append(node)
    
    # Second pass: add children recursively
    def add_children(parent_node: Dict[str, Any]):
        for loc in locations:
            if loc.parent_id == parent_node["id"]:
                child_node = loc.dict()
                child_node["children"] = []
                parent_node["children"].append(child_node)
                add_children(child_node)  # Recursive for deeper levels
    
    for node in tree:
        add_children(node)
    
    return tree

def find_node_in_tree(tree: List[Dict], node_id: str) -> Optional[Dict]:
    """Find node in tree by ID"""
    for node in tree:
        if node["id"] == node_id:
            return node
        if "children" in node:
            found = find_node_in_tree(node["children"], node_id)
            if found:
                return found
    return None

@router.get("/locations", response_model=List[LocationModel])
async def get_locations(
    parent_id: Optional[str] = None,
    type: Optional[str] = None,
    include_children: bool = Query(True, description="Include child nodes"),
    flatten: bool = Query(False, description="Return flat list instead of tree")
):
    """Get locations with optional filtering"""
    try:
        db = get_database()
        locations_collection = db.locations
        
        # Build query
        query = {"status": "active"}
        if parent_id is not None:
            query["parent_id"] = parent_id
        if type:
            query["type"] = type
        
        locations_cursor = locations_collection.find(query).sort("order_index", 1)
        locations = await locations_cursor.to_list(length=1000)
        
        # Convert MongoDB documents
        result = []
        for loc in locations:
            loc["id"] = str(loc["_id"])
            del loc["_id"]
            result.append(LocationModel(**loc))
        
        # If no data in database, create and populate sample hierarchy
        if not result and parent_id is None:
            logger.info("No locations in database, creating sample data...")
            sample_locations = create_sample_locations()
            
            # Save to database if possible
            try:
                for loc in sample_locations:
                    location_dict = loc.dict()
                    location_dict["_id"] = location_dict["id"]
                    await locations_collection.insert_one(location_dict)
                logger.info(f"Created {len(sample_locations)} sample locations in database")
                result = sample_locations
            except Exception as e:
                logger.warning(f"Could not save to database, using in-memory: {e}")
                for loc in sample_locations:
                    locations_storage[loc.id] = loc
                result = sample_locations
        
        # Build tree structure if requested
        if include_children and not flatten and parent_id is None:
            return build_location_tree(result)
        
        return result
        
    except Exception as e:
        logger.error(f"Database query failed, using in-memory: {e}")
        
        # Fallback to in-memory storage
        if not locations_storage and parent_id is None:
            sample_locations = create_sample_locations()
            for loc in sample_locations:
                locations_storage[loc.id] = loc
        
        # Filter in-memory data
        filtered_locations = list(locations_storage.values())
        
        if parent_id is not None:
            filtered_locations = [loc for loc in filtered_locations if loc.parent_id == parent_id]
        if type:
            filtered_locations = [loc for loc in filtered_locations if loc.type == type]
        
        # Sort by order_index
        filtered_locations.sort(key=lambda x: x.order_index)
        
        return filtered_locations

@router.get("/locations/tree")
async def get_location_tree():
    """Get complete location hierarchy as tree"""
    locations = await get_locations()
    return build_location_tree(locations)

@router.get("/locations/{location_id}", response_model=LocationModel)
async def get_location(location_id: str):
    """Get specific location by ID"""
    try:
        db = get_database()
        location = await db.locations.find_one({"_id": location_id})
        
        if not location:
            if location_id in locations_storage:
                return locations_storage[location_id]
            raise HTTPException(status_code=404, detail="Location not found")
        
        location["id"] = str(location["_id"])
        del location["_id"]
        return LocationModel(**location)
        
    except HTTPException:
        raise
    except Exception as e:
        if location_id in locations_storage:
            return locations_storage[location_id]
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
        
        # Try to save to database
        try:
            db = get_database()
            location_dict = location.dict()
            location_dict["_id"] = location_dict["id"]
            await db.locations.insert_one(location_dict)
            logger.info(f"Created location {location.name} in database")
        except Exception as e:
            logger.warning(f"Database save failed, using in-memory: {e}")
            locations_storage[location.id] = location
        
        return location
        
    except Exception as e:
        logger.error(f"Failed to create location: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/locations/{location_id}", response_model=LocationModel)
async def update_location(location_id: str, update_data: LocationUpdateRequest):
    """Update existing location"""
    try:
        # Get existing location
        try:
            db = get_database()
            existing = await db.locations.find_one({"_id": location_id})
            
            if existing:
                # Update in database
                update_dict = update_data.dict(exclude_none=True)
                update_dict["updated_at"] = datetime.utcnow()
                
                await db.locations.update_one(
                    {"_id": location_id},
                    {"$set": update_dict}
                )
                
                # Reload from database
                updated = await db.locations.find_one({"_id": location_id})
                updated["id"] = str(updated["_id"])
                del updated["_id"]
                result = LocationModel(**updated)
                
                logger.info(f"Updated location {location_id} in database")
                return result
                
        except Exception as db_error:
            logger.warning(f"Database update failed: {db_error}")
        
        # Fallback to in-memory
        if location_id not in locations_storage:
            raise HTTPException(status_code=404, detail="Location not found")
        
        existing_location = locations_storage[location_id]
        update_dict = update_data.dict(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        for key, value in update_dict.items():
            setattr(existing_location, key, value)
        
        locations_storage[location_id] = existing_location
        logger.info(f"Updated location {location_id} in memory")
        
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
        deleted_count = 0
        
        # ✅ FIXED: Proper async function to delete recursively
        async def delete_location_recursive(loc_id: str) -> int:
            count = 0
            
            try:
                # Try database first
                db = get_database()
                
                # Find and delete children first
                children_cursor = db.locations.find({"parent_id": loc_id})
                children = await children_cursor.to_list(length=1000)
                
                for child in children:
                    child_id = str(child["_id"])
                    count += await delete_location_recursive(child_id)
                
                # Delete the location itself from database
                result = await db.locations.delete_one({"_id": loc_id})
                if result.deleted_count > 0:
                    count += 1
                    logger.info(f"Deleted location {loc_id} from database")
                
            except Exception as db_error:
                logger.warning(f"Database delete failed for {loc_id}: {db_error}")
            
            # Also delete from in-memory storage
            if loc_id in locations_storage:
                # Find and delete children from memory
                children_in_memory = [loc.id for loc in locations_storage.values() if loc.parent_id == loc_id]
                for child_id in children_in_memory:
                    if child_id in locations_storage:
                        del locations_storage[child_id]
                        count += 1
                
                del locations_storage[loc_id]
                count += 1
                logger.info(f"Deleted location {loc_id} from memory")
            
            return count
        
        # Start recursive deletion
        deleted_count = await delete_location_recursive(location_id)
        
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        
        return {
            "success": True,
            "message": f"Location and {deleted_count - 1} children deleted",
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
        # Validate that new parent exists (if specified)
        if move_data.new_parent_id:
            parent_exists = False
            try:
                db = get_database()
                parent = await db.locations.find_one({"_id": move_data.new_parent_id})
                parent_exists = parent is not None
            except Exception:
                parent_exists = move_data.new_parent_id in locations_storage
            
            if not parent_exists:
                raise HTTPException(status_code=404, detail="Parent location not found")
        
        # Update location
        update_data = LocationUpdateRequest(
            parent_id=move_data.new_parent_id,
            order_index=move_data.new_order_index
        )
        
        updated_location = await update_location(location_id, update_data)
        
        return {
            "success": True,
            "message": "Location moved successfully",
            "location": updated_location
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to move location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/{location_id}/children", response_model=List[LocationModel])
async def get_location_children(location_id: str, type: Optional[str] = None):
    """Get direct children of a location"""
    return await get_locations(parent_id=location_id, type=type, include_children=False)

@router.get("/locations/{location_id}/devices")
async def get_location_devices(location_id: str):
    """Get all devices in this location and its children"""
    try:
        # This would integrate with devices API
        # For now, return mock devices for demonstration
        mock_devices = [
            {
                "id": f"dev_{location_id}_001",
                "name": "Temperature Sensor",
                "type": "sensor",
                "status": "online",
                "protocol": "modbus-tcp",
                "last_seen": datetime.utcnow().isoformat()
            },
            {
                "id": f"dev_{location_id}_002",
                "name": "Pressure Monitor", 
                "type": "sensor",
                "status": "online",
                "protocol": "opc-ua",
                "last_seen": datetime.utcnow().isoformat()
            }
        ] if location_id in ['area_production_001', 'area_production_002'] else []
        
        return {
            "location_id": location_id,
            "devices": mock_devices,
            "device_count": len(mock_devices),
            "message": "Mock devices - real integration coming soon"
        }
    except Exception as e:
        logger.error(f"Failed to get devices for location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/stats")
async def get_location_stats():
    """Get location statistics"""
    try:
        stats = {
            "total": 0,
            "locations": 0,
            "areas": 0,
            "active": 0,
            "inactive": 0
        }
        
        try:
            db = get_database()
            
            # Count by type and status
            pipeline = [
                {"$group": {
                    "_id": {"type": "$type", "status": "$status"}, 
                    "count": {"$sum": 1}
                }}
            ]
            
            stats_cursor = db.locations.aggregate(pipeline)
            stats_data = await stats_cursor.to_list(length=100)
            
            for stat in stats_data:
                group = stat["_id"]
                count = stat["count"]
                stats["total"] += count
                
                if group["type"] == "location":
                    stats["locations"] += count
                elif group["type"] == "area":
                    stats["areas"] += count
                    
                if group["status"] == "active":
                    stats["active"] += count
                else:
                    stats["inactive"] += count
                    
        except Exception as db_error:
            logger.warning(f"Database stats failed: {db_error}")
        
        # If no database data, use in-memory
        if stats["total"] == 0 and locations_storage:
            for loc in locations_storage.values():
                stats["total"] += 1
                if loc.type == "location":
                    stats["locations"] += 1
                elif loc.type == "area":
                    stats["areas"] += 1
                    
                if loc.status == "active":
                    stats["active"] += 1
                else:
                    stats["inactive"] += 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get location stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))