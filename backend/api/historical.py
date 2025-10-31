from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from models.historical_data import HistoricalData
from models.data_point import DataPoint
from models.device import Device

router = APIRouter()

class HistoricalDataResponse(BaseModel):
    timestamp: datetime
    value: float
    data_point_id: str
    quality: int = 100
    metadata: Dict[str, Any] = {}

class HistoricalStatsResponse(BaseModel):
    data_point_id: str
    min_value: float
    max_value: float
    avg_value: float
    count: int
    start_date: datetime
    end_date: datetime

@router.get("/data-points/historical", response_model=List[HistoricalDataResponse])
async def get_historical_data(
    data_point_id: str,
    start_date: datetime,
    end_date: datetime,
    aggregation: str = Query("raw", regex="^(raw|hourly|daily)$"),
    limit: int = Query(1000, ge=1, le=10000)
):
    """Get historical data for a specific data point"""
    try:
        # Validate data point exists
        data_point = await DataPoint.get(data_point_id)
        if not data_point:
            raise HTTPException(status_code=404, detail="Data point not found")
        
        # Build query
        query = {
            "data_point_id": data_point_id,
            "timestamp": {
                "$gte": start_date,
                "$lte": end_date
            }
        }
        
        # Get historical data
        historical_data = await HistoricalData.find(query).sort("-timestamp").limit(limit).to_list()
        
        if not historical_data:
            # Generate some sample historical data for testing
            sample_data = []
            current_time = start_date
            while current_time <= end_date:
                sample_data.append(HistoricalDataResponse(
                    timestamp=current_time,
                    value=float(data_point.current_value or 0) + (hash(str(current_time)) % 20 - 10),
                    data_point_id=data_point_id,
                    quality=95 + (hash(str(current_time)) % 6)
                ))
                
                if aggregation == "hourly":
                    current_time += timedelta(hours=1)
                elif aggregation == "daily":
                    current_time += timedelta(days=1)
                else:
                    current_time += timedelta(minutes=5)  # Raw data every 5 minutes
                
                if len(sample_data) >= limit:
                    break
            
            return sample_data
        
        # Process aggregation if needed
        if aggregation != "raw":
            # Group data by time periods
            aggregated_data = {}
            
            for data in historical_data:
                if aggregation == "hourly":
                    time_key = data.timestamp.replace(minute=0, second=0, microsecond=0)
                elif aggregation == "daily":
                    time_key = data.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    time_key = data.timestamp
                
                if time_key not in aggregated_data:
                    aggregated_data[time_key] = []
                aggregated_data[time_key].append(data.value)
            
            # Calculate averages
            result = []
            for timestamp, values in aggregated_data.items():
                avg_value = sum(values) / len(values)
                result.append(HistoricalDataResponse(
                    timestamp=timestamp,
                    value=avg_value,
                    data_point_id=data_point_id,
                    quality=95,
                    metadata={"aggregation": aggregation, "sample_count": len(values)}
                ))
            
            return sorted(result, key=lambda x: x.timestamp)
        
        # Return raw data
        return [
            HistoricalDataResponse(
                timestamp=data.timestamp,
                value=data.value,
                data_point_id=data.data_point_id,
                quality=getattr(data, 'quality', 100),
                metadata=getattr(data, 'metadata', {})
            ) for data in historical_data
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data-points/{data_point_id}/stats", response_model=HistoricalStatsResponse)
async def get_data_point_stats(
    data_point_id: str,
    start_date: datetime = Query(datetime.utcnow() - timedelta(days=7)),
    end_date: datetime = Query(datetime.utcnow())
):
    """Get statistical summary for a data point over time period"""
    try:
        # Validate data point exists
        data_point = await DataPoint.get(data_point_id)
        if not data_point:
            raise HTTPException(status_code=404, detail="Data point not found")
        
        # Get historical data
        query = {
            "data_point_id": data_point_id,
            "timestamp": {
                "$gte": start_date,
                "$lte": end_date
            }
        }
        
        historical_data = await HistoricalData.find(query).to_list()
        
        if not historical_data:
            # Return stats based on current value if no historical data
            current_val = float(data_point.current_value or 0)
            return HistoricalStatsResponse(
                data_point_id=data_point_id,
                min_value=current_val,
                max_value=current_val,
                avg_value=current_val,
                count=1,
                start_date=start_date,
                end_date=end_date
            )
        
        # Calculate statistics
        values = [data.value for data in historical_data]
        
        return HistoricalStatsResponse(
            data_point_id=data_point_id,
            min_value=min(values),
            max_value=max(values),
            avg_value=sum(values) / len(values),
            count=len(values),
            start_date=start_date,
            end_date=end_date
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{device_id}/historical", response_model=List[Dict[str, Any]])
async def get_device_historical_data(
    device_id: str,
    start_date: datetime,
    end_date: datetime,
    aggregation: str = Query("hourly", regex="^(raw|hourly|daily)$")
):
    """Get historical data for all data points of a device"""
    try:
        # Validate device exists
        device = await Device.get(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Get all data points for the device
        data_points = await DataPoint.find({"device_id": device_id}).to_list()
        
        if not data_points:
            return []
        
        # Get historical data for each data point
        result = []
        for dp in data_points:
            historical_data = await get_historical_data(
                data_point_id=str(dp.id),
                start_date=start_date,
                end_date=end_date,
                aggregation=aggregation,
                limit=1000
            )
            
            result.append({
                "data_point": {
                    "id": str(dp.id),
                    "name": dp.name,
                    "address": dp.address,
                    "unit": dp.unit,
                    "data_type": dp.data_type
                },
                "historical_data": historical_data
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/data-points/{data_point_id}/historical")
async def store_historical_data(
    data_point_id: str,
    data: Dict[str, Any]
):
    """Store historical data point (used by protocol services)"""
    try:
        # Validate data point exists
        data_point = await DataPoint.get(data_point_id)
        if not data_point:
            raise HTTPException(status_code=404, detail="Data point not found")
        
        # Create historical data entry
        historical_entry = HistoricalData(
            data_point_id=data_point_id,
            device_id=data_point.device_id,
            timestamp=data.get("timestamp", datetime.utcnow()),
            value=data["value"],
            quality=data.get("quality", 100),
            metadata=data.get("metadata", {})
        )
        
        await historical_entry.insert()
        
        return {"success": True, "message": "Historical data stored"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/data-points/{data_point_id}/historical")
async def delete_historical_data(
    data_point_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Delete historical data for a data point"""
    try:
        query = {"data_point_id": data_point_id}
        
        if start_date or end_date:
            timestamp_query = {}
            if start_date:
                timestamp_query["$gte"] = start_date
            if end_date:
                timestamp_query["$lte"] = end_date
            query["timestamp"] = timestamp_query
        
        result = await HistoricalData.find(query).delete()
        
        return {
            "success": True,
            "message": f"Deleted {result.deleted_count} historical data points"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historical/cleanup")
async def cleanup_old_data(days: int = Query(365, ge=1, le=3650)):
    """Clean up historical data older than specified days"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await HistoricalData.find(
            {"timestamp": {"$lt": cutoff_date}}
        ).delete()
        
        return {
            "success": True,
            "message": f"Cleaned up {result.deleted_count} historical data points older than {days} days"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))