from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta

from models.monitoring import MonitoringData, MonitoringMetrics
from models.protocol import Protocol

router = APIRouter()

@router.get("/monitoring", response_model=List[dict])
async def get_monitoring_data(
    protocol_id: Optional[str] = Query(None, description="Filter by protocol ID"),
    hours: int = Query(24, description="Hours of data to retrieve")
):
    """Get monitoring data"""
    try:
        # Calculate time range
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # Build query
        query = MonitoringData.timestamp >= start_time
        if protocol_id:
            query = query & (MonitoringData.protocol_id == protocol_id)
        
        monitoring_data = await MonitoringData.find(query).sort(-MonitoringData.timestamp).to_list()
        
        result = []
        for data in monitoring_data:
            data_dict = data.dict()
            data_dict["id"] = str(data.id)
            result.append(data_dict)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/monitoring/metrics")
async def get_metrics(range: str = Query("1h", description="Time range (1h, 6h, 24h, 7d)")):
    """Get aggregated metrics"""
    try:
        # Parse time range
        time_mapping = {
            "1h": 1,
            "6h": 6,
            "24h": 24,
            "7d": 168  # 7 days * 24 hours
        }
        
        hours = time_mapping.get(range, 1)
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # Get all protocols for overview
        protocols = await Protocol.find_all().to_list()
        
        # Get monitoring data for the time range
        monitoring_data = await MonitoringData.find(
            MonitoringData.timestamp >= start_time
        ).to_list()
        
        # Calculate aggregated metrics
        total_bytes_per_second = 0
        total_messages_per_second = 0
        avg_error_rate = 0
        avg_latency = 0
        total_connections = 0
        
        if monitoring_data:
            total_bytes_per_second = sum(d.metrics.bytes_per_second for d in monitoring_data) / len(monitoring_data)
            total_messages_per_second = sum(d.metrics.messages_per_second for d in monitoring_data) / len(monitoring_data)
            avg_error_rate = sum(d.metrics.error_rate for d in monitoring_data) / len(monitoring_data)
            avg_latency = sum(d.metrics.latency for d in monitoring_data) / len(monitoring_data)
            total_connections = sum(d.metrics.connection_count for d in monitoring_data) / len(monitoring_data)
        
        # Protocol-specific metrics
        protocol_metrics = {}
        for protocol in protocols:
            protocol_data = [d for d in monitoring_data if d.protocol_id == str(protocol.id)]
            if protocol_data:
                protocol_metrics[str(protocol.id)] = {
                    "name": protocol.name,
                    "type": protocol.type,
                    "status": protocol.status,
                    "bytes_per_second": sum(d.metrics.bytes_per_second for d in protocol_data) / len(protocol_data),
                    "messages_per_second": sum(d.metrics.messages_per_second for d in protocol_data) / len(protocol_data),
                    "error_rate": sum(d.metrics.error_rate for d in protocol_data) / len(protocol_data),
                    "latency": sum(d.metrics.latency for d in protocol_data) / len(protocol_data),
                    "data_points": len(protocol_data)
                }
        
        return {
            "timeRange": range,
            "totalProtocols": len(protocols),
            "activeProtocols": len([p for p in protocols if p.status == "connected"]),
            "aggregatedMetrics": {
                "bytesPerSecond": round(total_bytes_per_second, 2),
                "messagesPerSecond": round(total_messages_per_second, 2),
                "errorRate": round(avg_error_rate, 2),
                "latency": round(avg_latency, 2),
                "connectionCount": round(total_connections, 0)
            },
            "protocolMetrics": protocol_metrics,
            "dataPoints": len(monitoring_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/monitoring/realtime")
async def get_realtime_data():
    """Get current real-time monitoring data"""
    try:
        # Get latest monitoring data for each protocol
        protocols = await Protocol.find_all().to_list()
        realtime_data = []
        
        for protocol in protocols:
            latest_data = await MonitoringData.find(
                MonitoringData.protocol_id == str(protocol.id)
            ).sort(-MonitoringData.timestamp).limit(1).to_list()
            
            if latest_data:
                data_dict = latest_data[0].dict()
                data_dict["id"] = str(latest_data[0].id)
                data_dict["protocol_name"] = protocol.name
                data_dict["protocol_type"] = protocol.type
                realtime_data.append(data_dict)
        
        return realtime_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))