from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from models.system_settings import SystemSettings
from database.mongodb import get_database

router = APIRouter()

class WidgetConfig(BaseModel):
    id: str
    type: str  # gauge, line_chart, bar_chart, kpi, status, table
    title: str
    data_point_ids: List[str]
    position: Dict[str, int]  # {x, y, w, h}
    configuration: Dict[str, Any] = {}
    visible: bool = True

class DashboardModel(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    widgets: List[WidgetConfig] = []
    layout: str = "grid"  # grid, flex, custom
    is_default: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class DashboardCreateRequest(BaseModel):
    name: str
    description: str = ""
    is_default: bool = False

class DashboardUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[List[WidgetConfig]] = None
    layout: Optional[str] = None
    is_default: Optional[bool] = None

# In-memory storage for dashboards (in production, this would be MongoDB)
dashboards_storage: Dict[str, DashboardModel] = {}

@router.get("/dashboards", response_model=List[DashboardModel])
async def get_dashboards():
    """Get all dashboards"""
    try:
        # Try to load from database first
        db = get_database()
        dashboards_collection = db.dashboards
        
        dashboards_cursor = dashboards_collection.find({})
        dashboards = await dashboards_cursor.to_list(length=100)
        
        if not dashboards:
            # Create default dashboard if none exist
            default_dashboard = DashboardModel(
                id="default",
                name="System Overview",
                description="Default system monitoring dashboard",
                widgets=[
                    WidgetConfig(
                        id="system_status",
                        type="kpi",
                        title="System Status",
                        data_point_ids=[],
                        position={"x": 0, "y": 0, "w": 2, "h": 1},
                        configuration={"show_icon": True, "color": "green"}
                    ),
                    WidgetConfig(
                        id="device_count",
                        type="kpi",
                        title="Connected Devices",
                        data_point_ids=[],
                        position={"x": 2, "y": 0, "w": 2, "h": 1},
                        configuration={"show_icon": True, "color": "blue"}
                    )
                ],
                is_default=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Insert default dashboard
            dashboard_dict = default_dashboard.dict()
            dashboard_dict["_id"] = dashboard_dict["id"]
            await dashboards_collection.insert_one(dashboard_dict)
            dashboards = [dashboard_dict]
        
        # Convert MongoDB documents to response format
        result = []
        for dashboard in dashboards:
            dashboard["id"] = dashboard.get("_id", dashboard.get("id"))
            if "_id" in dashboard:
                del dashboard["_id"]
            result.append(dashboard)
        
        return result
        
    except Exception as e:
        # Fallback to in-memory storage
        if not dashboards_storage:
            # Create default dashboard
            default_dashboard = DashboardModel(
                id="default",
                name="System Overview",
                description="Default system monitoring dashboard",
                is_default=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            dashboards_storage["default"] = default_dashboard
        
        return list(dashboards_storage.values())

@router.get("/dashboards/{dashboard_id}", response_model=DashboardModel)
async def get_dashboard(dashboard_id: str):
    """Get dashboard by ID"""
    try:
        db = get_database()
        dashboard = await db.dashboards.find_one({"_id": dashboard_id})
        
        if not dashboard:
            # Check in-memory storage
            if dashboard_id in dashboards_storage:
                return dashboards_storage[dashboard_id]
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        dashboard["id"] = dashboard["_id"]
        del dashboard["_id"]
        return dashboard
        
    except HTTPException:
        raise
    except Exception as e:
        if dashboard_id in dashboards_storage:
            return dashboards_storage[dashboard_id]
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dashboards", response_model=DashboardModel)
async def create_dashboard(dashboard_data: DashboardCreateRequest):
    """Create new dashboard"""
    try:
        dashboard = DashboardModel(
            id=f"dashboard_{int(datetime.utcnow().timestamp())}",
            name=dashboard_data.name,
            description=dashboard_data.description,
            is_default=dashboard_data.is_default,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Try to save to database
        try:
            db = get_database()
            dashboard_dict = dashboard.dict()
            dashboard_dict["_id"] = dashboard_dict["id"]
            await db.dashboards.insert_one(dashboard_dict)
        except Exception as e:
            print(f"Database save failed, using in-memory: {e}")
            dashboards_storage[dashboard.id] = dashboard
        
        return dashboard
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/dashboards/{dashboard_id}", response_model=DashboardModel)
async def update_dashboard(dashboard_id: str, dashboard_data: DashboardUpdateRequest):
    """Update dashboard"""
    try:
        # Try database first
        db = get_database()
        dashboard = await db.dashboards.find_one({"_id": dashboard_id})
        
        if not dashboard:
            # Check in-memory storage
            if dashboard_id not in dashboards_storage:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            dashboard = dashboards_storage[dashboard_id].dict()
        
        # Update fields
        update_data = dashboard_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                dashboard[field] = value
        
        dashboard["updated_at"] = datetime.utcnow()
        
        # Save to database
        try:
            await db.dashboards.replace_one(
                {"_id": dashboard_id},
                dashboard
            )
        except Exception as e:
            print(f"Database update failed, using in-memory: {e}")
            dashboard["id"] = dashboard_id
            dashboards_storage[dashboard_id] = DashboardModel(**dashboard)
        
        dashboard["id"] = dashboard_id
        return dashboard
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str):
    """Delete dashboard"""
    try:
        # Try database first
        db = get_database()
        result = await db.dashboards.delete_one({"_id": dashboard_id})
        
        if result.deleted_count == 0:
            # Check in-memory storage
            if dashboard_id in dashboards_storage:
                del dashboards_storage[dashboard_id]
                return {"success": True, "message": "Dashboard deleted successfully"}
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        return {"success": True, "message": "Dashboard deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboards/{dashboard_id}/export")
async def export_dashboard(dashboard_id: str):
    """Export dashboard configuration"""
    try:
        dashboard = await get_dashboard(dashboard_id)
        
        return {
            "dashboard": dashboard.dict(),
            "export_timestamp": datetime.utcnow().isoformat(),
            "export_version": "1.0"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dashboards/import")
async def import_dashboard(dashboard_data: Dict[str, Any]):
    """Import dashboard configuration"""
    try:
        if "dashboard" not in dashboard_data:
            raise HTTPException(status_code=400, detail="Invalid import data")
        
        dashboard_config = dashboard_data["dashboard"]
        
        # Create new dashboard with imported data
        dashboard = DashboardModel(
            id=f"imported_{int(datetime.utcnow().timestamp())}",
            name=f"Imported - {dashboard_config.get('name', 'Dashboard')}",
            description=dashboard_config.get('description', ''),
            widgets=[WidgetConfig(**widget) for widget in dashboard_config.get('widgets', [])],
            layout=dashboard_config.get('layout', 'grid'),
            is_default=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save to database
        try:
            db = get_database()
            dashboard_dict = dashboard.dict()
            dashboard_dict["_id"] = dashboard_dict["id"]
            await db.dashboards.insert_one(dashboard_dict)
        except Exception as e:
            print(f"Database save failed, using in-memory: {e}")
            dashboards_storage[dashboard.id] = dashboard
        
        return dashboard
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))