from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import httpx
import asyncio
from datetime import datetime
import os

router = APIRouter()

# Configuration
N8N_URL = os.getenv("N8N_URL", "http://n8n:5678")
N8N_USERNAME = os.getenv("N8N_USERNAME", "admin")
N8N_PASSWORD = os.getenv("N8N_PASSWORD", "industrial_n8n_2024")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

@router.get("/integrations/status")
async def get_integration_status():
    """Get status of all integrations"""
    status = {
        "n8n": {"connected": False, "url": N8N_URL},
        "ollama": {"connected": False, "url": OLLAMA_URL}
    }
    
    # Check N8N connection
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            auth = httpx.BasicAuth(N8N_USERNAME, N8N_PASSWORD)
            response = await client.get(f"{N8N_URL}/api/v1/workflows", auth=auth)
            status["n8n"]["connected"] = response.status_code == 200
            if response.status_code == 200:
                data = response.json()
                status["n8n"]["workflows"] = len(data.get("data", []))
    except Exception as e:
        print(f"N8N connection error: {e}")
    
    # Check Ollama connection
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            status["ollama"]["connected"] = response.status_code == 200
            if response.status_code == 200:
                data = response.json()
                status["ollama"]["models"] = len(data.get("models", []))
    except Exception as e:
        print(f"Ollama connection error: {e}")
    
    return status

@router.get("/integrations/n8n/workflows")
async def get_n8n_workflows():
    """Get list of N8N workflows"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            auth = httpx.BasicAuth(N8N_USERNAME, N8N_PASSWORD)
            response = await client.get(f"{N8N_URL}/api/v1/workflows", auth=auth)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch N8N workflows")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"N8N service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integrations/n8n/workflows/{workflow_id}/activate")
async def activate_n8n_workflow(workflow_id: str):
    """Activate N8N workflow"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            auth = httpx.BasicAuth(N8N_USERNAME, N8N_PASSWORD)
            response = await client.post(
                f"{N8N_URL}/api/v1/workflows/{workflow_id}/activate",
                auth=auth
            )
            
            if response.status_code == 200:
                return {"success": True, "message": "Workflow activated successfully"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to activate workflow")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"N8N service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integrations/n8n/workflows/{workflow_id}/deactivate")
async def deactivate_n8n_workflow(workflow_id: str):
    """Deactivate N8N workflow"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            auth = httpx.BasicAuth(N8N_USERNAME, N8N_PASSWORD)
            response = await client.post(
                f"{N8N_URL}/api/v1/workflows/{workflow_id}/deactivate",
                auth=auth
            )
            
            if response.status_code == 200:
                return {"success": True, "message": "Workflow deactivated successfully"}
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to deactivate workflow")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"N8N service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/integrations/ollama/models")
async def get_ollama_models():
    """Get list of available Ollama models"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch Ollama models")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integrations/llm/query")
async def query_llm(request: Dict[str, Any]):
    """Send query to Ollama LLM"""
    prompt = request.get("prompt", "")
    model = request.get("model", "llama3.2")  # Default model
    
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            ollama_request = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_tokens": 2048
                }
            }
            
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=ollama_request
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "response": data.get("response", ""),
                    "model": model,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="LLM query failed")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integrations/n8n/trigger/{webhook_name}")
async def trigger_n8n_webhook(webhook_name: str, payload: Dict[str, Any]):
    """Trigger N8N webhook with industrial data"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Send webhook to N8N
            response = await client.post(
                f"{N8N_URL}/webhook/{webhook_name}",
                json={
                    **payload,
                    "source": "industrial-iot-system",
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            return {
                "success": response.status_code in [200, 201, 202],
                "status_code": response.status_code,
                "message": "Webhook triggered successfully" if response.status_code in [200, 201, 202] else "Webhook trigger failed"
            }
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"N8N service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/integrations/system-analysis")
async def get_system_analysis():
    """Get AI-powered system analysis"""
    try:
        # Gather system data for analysis
        from models.protocol import Protocol
        from models.device import Device
        from models.monitoring import MonitoringData
        from datetime import timedelta
        
        # Get recent system data
        protocols = await Protocol.find_all().to_list()
        devices = await Device.find_all().to_list()
        recent_monitoring = await MonitoringData.find(
            MonitoringData.timestamp >= datetime.now() - timedelta(hours=24)
        ).limit(100).to_list()
        
        # Prepare data for LLM analysis
        system_summary = {
            "protocols": {
                "total": len(protocols),
                "active": len([p for p in protocols if p.status == "connected"]),
                "types": list(set([p.type for p in protocols]))
            },
            "devices": {
                "total": len(devices),
                "active": len([d for d in devices if d.status == "active"]),
                "error_count": len([d for d in devices if d.status == "error"])
            },
            "monitoring": {
                "data_points_last_24h": len(recent_monitoring),
                "average_cpu": sum([m.cpu_usage for m in recent_monitoring if m.cpu_usage]) / max(len(recent_monitoring), 1),
                "average_memory": sum([m.memory_usage for m in recent_monitoring if m.memory_usage]) / max(len(recent_monitoring), 1)
            }
        }
        
        prompt = f"""Przeanalizuj następujący system IoT przemysłowy i podaj rekomendacje:
        
System Industrial IoT - Analiza z {datetime.now().strftime('%Y-%m-%d %H:%M')}:
        
Protokoły komunikacyjne:
        - Łącznie: {system_summary['protocols']['total']}
        - Aktywne: {system_summary['protocols']['active']}
        - Typy: {', '.join(system_summary['protocols']['types'])}
        
Urządzenia:
        - Łącznie: {system_summary['devices']['total']}
        - Aktywne: {system_summary['devices']['active']}
        - Z błędami: {system_summary['devices']['error_count']}
        
Monitoring (ostatnie 24h):
        - Punkty danych: {system_summary['monitoring']['data_points_last_24h']}
        - Średnie użycie CPU: {system_summary['monitoring']['average_cpu']:.1f}%
        - Średnie użycie pamięci: {system_summary['monitoring']['average_memory']:.1f}%
        
Podaj krótką analizę stanu systemu, potencjalne problemy i rekomendacje optymalizacji.
        """
        
        # Query LLM for analysis
        async with httpx.AsyncClient(timeout=60.0) as client:
            ollama_request = {
                "model": "llama3.2",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.9
                }
            }
            
            response = await client.post(f"{OLLAMA_URL}/api/generate", json=ollama_request)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "analysis": data.get("response", ""),
                    "system_data": system_summary,
                    "timestamp": datetime.now().isoformat()
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"System analysis failed: {str(e)}")

@router.post("/integrations/alerts/send")
async def send_alert_to_n8n(alert_data: Dict[str, Any]):
    """Send system alert to N8N for processing"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Send to N8N alert webhook
            webhook_payload = {
                "type": "system_alert",
                "severity": alert_data.get("severity", "info"),
                "message": alert_data.get("message", ""),
                "source": alert_data.get("source", "industrial-iot"),
                "timestamp": datetime.now().isoformat(),
                "data": alert_data.get("data", {})
            }
            
            response = await client.post(
                f"{N8N_URL}/webhook/industrial-alerts",
                json=webhook_payload
            )
            
            return {
                "success": response.status_code in [200, 201, 202],
                "status_code": response.status_code,
                "message": "Alert sent successfully" if response.status_code in [200, 201, 202] else "Alert sending failed"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))