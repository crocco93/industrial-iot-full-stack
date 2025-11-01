from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from database.mongodb import get_database

router = APIRouter()

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
        
        # If no data in database, create sample hierarchy
        if not result and parent_id is None:
            sample_locations = create_sample_locations()
            for loc in sample_locations:
                locations_storage[loc.id] = loc
            result = sample_locations
        
        # Build tree structure if requested
        if include_children and not flatten and parent_id is None:
            return build_location_tree(result)
        
        return result
        
    except Exception as e:
        print(f"Database query failed, using in-memory: {e}")
        
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
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        
        # Areas in Main Factory
        LocationModel(
            id="area_production_001",
            name="Production Floor A",
            description="Main production line",
            type="area",
            parent_id="loc_factory_001",
            order_index=0,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_production_002",
            name="Production Floor B",
            description="Secondary production line",
            type="area",
            parent_id="loc_factory_001",
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_quality_001",
            name="Quality Control",
            description="Quality assurance and testing",
            type="area",
            parent_id="loc_factory_001",
            order_index=2,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_utilities_001",
            name="Utilities",
            description="Power, water, HVAC systems",
            type="area",
            parent_id="loc_factory_001",
            order_index=3,
            created_at=now,
            updated_at=now
        ),
        
        # Areas in Warehouse
        LocationModel(
            id="area_receiving_001",
            name="Receiving Bay",
            description="Incoming goods reception",
            type="area",
            parent_id="loc_warehouse_001",
            order_index=0,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_storage_001",
            name="Main Storage",
            description="Primary storage area",
            type="area",
            parent_id="loc_warehouse_001",
            order_index=1,
            created_at=now,
            updated_at=now
        ),
        LocationModel(
            id="area_shipping_001",
            name="Shipping Bay",
            description="Outgoing goods dispatch",
            type="area",
            parent_id="loc_warehouse_001",
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
    
    for loc in locations:
        if loc.parent_id is None:
            # Root location
            node = loc.dict()
            node["children"] = []
            tree.append(node)
    
    # Add children
    for loc in locations:
        if loc.parent_id is not None:
            # Find parent in tree
            parent_node = find_node_in_tree(tree, loc.parent_id)
            if parent_node:
                child_node = loc.dict()
                child_node["children"] = []
                parent_node["children"].append(child_node)
    
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
        except Exception as e:
            print(f"Database save failed, using in-memory: {e}")
            locations_storage[location.id] = location
        
        return location
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/locations/{location_id}", response_model=LocationModel)
async def update_location(location_id: str, update_data: LocationUpdateRequest):
    """Update existing location"""
    try:
        # Get existing location
        db = get_database()
        existing = await db.locations.find_one({"_id": location_id})
        
        if not existing:
            if location_id not in locations_storage:
                raise HTTPException(status_code=404, detail="Location not found")
            existing_location = locations_storage[location_id]
        else:
            existing["id"] = str(existing["_id"])
            del existing["_id"]
            existing_location = LocationModel(**existing)
        
        # Update fields
        update_dict = update_data.dict(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        if existing:
            await db.locations.update_one(
                {"_id": location_id},
                {"$set": update_dict}
            )
            
            # Reload from database
            updated = await db.locations.find_one({"_id": location_id})
            updated["id"] = str(updated["_id"])
            del updated["_id"]
            result = LocationModel(**updated)
        else:
            # Update in-memory
            for key, value in update_dict.items():
                setattr(existing_location, key, value)
            result = existing_location
            locations_storage[location_id] = result
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/locations/{location_id}")
async def delete_location(location_id: str):
    """Delete location and all its children"""
    try:
        db = get_database()
        
        # First, find all children to delete
        children = await db.locations.find({"parent_id": location_id}).to_list(length=1000)
        child_ids = [str(child["_id"]) for child in children]
        
        # Delete all children first (recursive)
        for child_id in child_ids:
            await delete_location(child_id)
        
        # Delete the location itself
        result = await db.locations.delete_one({"_id": location_id})
        
        if result.deleted_count == 0:
            if location_id in locations_storage:
                # Also delete children from in-memory
                to_delete = [location_id]
                for loc_id, loc in locations_storage.items():
                    if loc.parent_id == location_id:
                        to_delete.append(loc_id)
                
                for del_id in to_delete:
                    if del_id in locations_storage:
                        del locations_storage[del_id]
                
                return {"success": True, "message": "Location deleted"}
            
            raise HTTPException(status_code=404, detail="Location not found")
        
        # Also remove from in-memory if exists
        if location_id in locations_storage:
            del locations_storage[location_id]
        
        return {"success": True, "message": "Location and all children deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
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
        # For now, return placeholder
        return {
            "location_id": location_id,
            "devices": [],
            "message": "Device integration pending"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations/stats")
async def get_location_stats():
    """Get location statistics"""
    try:
        db = get_database()
        
        # Count by type
        pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {"_id": "$type", "count": {"$sum": 1}}}
        ]
        
        stats_cursor = db.locations.aggregate(pipeline)
        stats_data = await stats_cursor.to_list(length=100)
        
        stats = {
            "total": 0,
            "locations": 0,
            "areas": 0
        }
        
        for stat in stats_data:
            loc_type = stat["_id"]
            count = stat["count"]
            stats["total"] += count
            
            if loc_type == "location":
                stats["locations"] += count
            elif loc_type == "area":
                stats["areas"] += count
        
        # If no database data, use in-memory
        if stats["total"] == 0 and locations_storage:
            for loc in locations_storage.values():
                stats["total"] += 1
                if loc.type == "location":
                    stats["locations"] += 1
                elif loc.type == "area":
                    stats["areas"] += 1
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))