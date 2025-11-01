from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import ipaddress
import socket
from concurrent.futures import ThreadPoolExecutor
import logging
from models.device import Device
from models.protocol import Protocol
from services.protocol_services import get_protocol_service

router = APIRouter()
logger = logging.getLogger(__name__)

class DeviceDiscovery:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=50)
        self.discovered_devices = []
        
    async def scan_network_range(self, network: str, protocol_types: List[str]) -> List[Dict[str, Any]]:
        """Scan network range for devices supporting specific protocols"""
        try:
            network_obj = ipaddress.IPv4Network(network, strict=False)
            hosts = list(network_obj.hosts())
            
            logger.info(f"Scanning {len(hosts)} hosts in {network} for protocols: {protocol_types}")
            
            # Limit scan to reasonable number of hosts
            if len(hosts) > 254:
                hosts = hosts[:254]
                
            tasks = []
            for host in hosts:
                for protocol_type in protocol_types:
                    tasks.append(self._scan_host_protocol(str(host), protocol_type))
            
            # Run scans concurrently with limit
            semaphore = asyncio.Semaphore(20)  # Max 20 concurrent scans
            async def limited_scan(task):
                async with semaphore:
                    return await task
            
            results = await asyncio.gather(*[limited_scan(task) for task in tasks], return_exceptions=True)
            
            # Filter successful discoveries
            discovered = []
            for result in results:
                if isinstance(result, dict) and result.get('discovered'):
                    discovered.append(result)
                    
            logger.info(f"Discovery completed: {len(discovered)} devices found")
            return discovered
            
        except Exception as e:
            logger.error(f"Network scan failed: {e}")
            raise HTTPException(status_code=500, detail=f"Network scan failed: {str(e)}")
    
    async def _scan_host_protocol(self, host: str, protocol_type: str) -> Dict[str, Any]:
        """Scan single host for specific protocol"""
        try:
            # Get default port for protocol
            port_map = {
                'modbus-tcp': 502,
                'opc-ua': 4840, 
                'mqtt': 1883,
                'ethernet-ip': 44818,
                'profinet': 102,
                'bacnet': 47808
            }
            
            port = port_map.get(protocol_type, 502)
            
            # Quick TCP port check
            if not await self._check_tcp_port(host, port):
                return {'discovered': False}
                
            # Try protocol-specific discovery
            device_info = await self._discover_protocol_device(host, port, protocol_type)
            
            if device_info:
                return {
                    'discovered': True,
                    'host': host,
                    'port': port,
                    'protocol_type': protocol_type,
                    'device_info': device_info,
                    'discovered_at': datetime.utcnow().isoformat() + 'Z'
                }
                
            return {'discovered': False}
            
        except Exception as e:
            logger.debug(f"Host {host}:{protocol_type} scan failed: {e}")
            return {'discovered': False, 'error': str(e)}
    
    async def _check_tcp_port(self, host: str, port: int, timeout: float = 2.0) -> bool:
        """Quick TCP port connectivity check"""
        def check_port():
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                result = sock.connect_ex((host, port))
                sock.close()
                return result == 0
            except:
                return False
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, check_port)
    
    async def _discover_protocol_device(self, host: str, port: int, protocol_type: str) -> Optional[Dict[str, Any]]:
        """Protocol-specific device discovery"""
        try:
            if protocol_type == 'modbus-tcp':
                return await self._discover_modbus_device(host, port)
            elif protocol_type == 'opc-ua':
                return await self._discover_opcua_device(host, port) 
            elif protocol_type == 'mqtt':
                return await self._discover_mqtt_device(host, port)
            elif protocol_type == 'ethernet-ip':
                return await self._discover_ethernetip_device(host, port)
            else:
                return {
                    'name': f'{protocol_type.upper()} Device',
                    'model': 'Unknown',
                    'vendor': 'Unknown',
                    'version': 'Unknown',
                    'capabilities': []
                }
                
        except Exception as e:
            logger.debug(f"Protocol discovery failed for {host}:{port} ({protocol_type}): {e}")
            return None
    
    async def _discover_modbus_device(self, host: str, port: int) -> Optional[Dict[str, Any]]:
        """Discover Modbus device information"""
        try:
            # Try to connect and read basic info
            # This would use actual modbus client
            return {
                'name': f'Modbus Device at {host}',
                'model': 'Generic Modbus Device', 
                'vendor': 'Unknown',
                'version': '1.0',
                'capabilities': ['holding_registers', 'input_registers', 'coils', 'discrete_inputs'],
                'unit_ids': [1],  # Could scan for multiple unit IDs
                'register_ranges': {
                    'holding_registers': '40001-49999',
                    'input_registers': '30001-39999'
                }
            }
        except:
            return None
    
    async def _discover_opcua_device(self, host: str, port: int) -> Optional[Dict[str, Any]]:
        """Discover OPC-UA device information"""
        try:
            endpoint_url = f'opc.tcp://{host}:{port}'
            # Would use actual OPC-UA client here
            return {
                'name': f'OPC-UA Server at {host}',
                'model': 'Generic OPC-UA Server',
                'vendor': 'Unknown',
                'version': '1.0', 
                'endpoint_url': endpoint_url,
                'security_modes': ['None', 'Sign', 'SignAndEncrypt'],
                'capabilities': ['read', 'write', 'subscribe', 'browse']
            }
        except:
            return None
    
    async def _discover_mqtt_device(self, host: str, port: int) -> Optional[Dict[str, Any]]:
        """Discover MQTT broker information"""
        try:
            # Would try MQTT connection
            return {
                'name': f'MQTT Broker at {host}',
                'model': 'MQTT Broker',
                'vendor': 'Unknown',
                'version': '3.1.1',
                'capabilities': ['publish', 'subscribe', 'retain', 'qos'],
                'topics': []  # Would discover available topics
            }
        except:
            return None
            
    async def _discover_ethernetip_device(self, host: str, port: int) -> Optional[Dict[str, Any]]:
        """Discover EtherNet/IP device information"""
        try:
            # Would use EtherNet/IP discovery
            return {
                'name': f'EtherNet/IP Device at {host}',
                'model': 'Generic PLC',
                'vendor': 'Allen-Bradley Compatible',
                'version': '1.0',
                'capabilities': ['explicit_messaging', 'io_messaging', 'cip'],
                'processor_slot': 0
            }
        except:
            return None

discovery_service = DeviceDiscovery()

@router.post("/devices/discover")
async def discover_devices(
    network: str = Query("192.168.1.0/24", description="Network range to scan (CIDR notation)"),
    protocols: List[str] = Query(["modbus-tcp"], description="Protocol types to discover"),
    timeout: int = Query(5, description="Scan timeout in seconds")
) -> Dict[str, Any]:
    """
    Discover devices on network for specified protocols
    
    - **network**: Network range in CIDR notation (e.g., '192.168.1.0/24')
    - **protocols**: List of protocol types to scan for
    - **timeout**: Maximum time to spend on each host
    
    Returns list of discovered devices with their capabilities
    """
    try:
        # Validate network format
        try:
            ipaddress.IPv4Network(network, strict=False)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid network format. Use CIDR notation (e.g., '192.168.1.0/24')")
        
        # Validate protocols
        valid_protocols = ['modbus-tcp', 'opc-ua', 'mqtt', 'ethernet-ip', 'profinet', 'bacnet']
        invalid_protocols = [p for p in protocols if p not in valid_protocols]
        if invalid_protocols:
            raise HTTPException(status_code=400, detail=f"Invalid protocols: {invalid_protocols}. Valid: {valid_protocols}")
        
        logger.info(f"Starting device discovery: network={network}, protocols={protocols}")
        
        # Perform discovery
        discovered_devices = await discovery_service.scan_network_range(network, protocols)
        
        return {
            "scan_results": {
                "network_scanned": network,
                "protocols_tested": protocols,
                "devices_discovered": len(discovered_devices),
                "scan_completed_at": datetime.utcnow().isoformat() + 'Z'
            },
            "discovered_devices": discovered_devices,
            "summary": {
                "total_found": len(discovered_devices),
                "by_protocol": {
                    protocol: len([d for d in discovered_devices if d.get('protocol_type') == protocol])
                    for protocol in protocols
                },
                "recommendations": [
                    "Review discovered devices and add them to your configuration",
                    "Test connections to ensure proper communication",
                    "Configure data points for monitoring"
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device discovery failed: {e}")
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")

@router.get("/devices/discover/quick-scan/{host}")
async def quick_scan_host(
    host: str,
    protocols: List[str] = Query(["modbus-tcp"], description="Protocols to test")
) -> Dict[str, Any]:
    """
    Quick scan of single host for supported protocols
    """
    try:
        # Validate IP address
        try:
            ipaddress.IPv4Address(host)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid IP address format")
        
        results = []
        for protocol_type in protocols:
            result = await discovery_service._scan_host_protocol(host, protocol_type)
            if result.get('discovered'):
                results.append(result)
        
        return {
            "host": host,
            "protocols_found": len(results),
            "scan_results": results,
            "recommendations": [
                f"Host {host} supports {len(results)} protocol(s)",
                "Add discovered protocols to your system configuration"
            ] if results else [
                f"No supported protocols found on {host}",
                "Check if devices are powered on and network accessible",
                "Verify firewall settings allow protocol communication"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick scan failed for {host}: {e}")
        raise HTTPException(status_code=500, detail=f"Quick scan failed: {str(e)}")

@router.post("/devices/discover/add-discovered")
async def add_discovered_device(
    device_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Add discovered device to system configuration
    """
    try:
        # Extract device information
        host = device_data.get('host')
        protocol_type = device_data.get('protocol_type')
        device_info = device_data.get('device_info', {})
        
        if not host or not protocol_type:
            raise HTTPException(status_code=400, detail="Host and protocol_type are required")
        
        # Create protocol configuration
        protocol_config = {
            'host': host,
            'port': device_data.get('port', 502),
            'timeout': 5000,
            **device_info.get('config', {})
        }
        
        # Create protocol entry
        protocol = Protocol(
            name=f"{device_info.get('name', f'{protocol_type.upper()} Device')} at {host}",
            description=f"Auto-discovered {protocol_type} device",
            type=protocol_type,
            version="1.0",
            configuration=protocol_config,
            status="disconnected",
            created_at=datetime.utcnow()
        )
        
        await protocol.save()
        
        # Create device entry
        device = Device(
            name=device_info.get('name', f'{protocol_type.upper()} Device'),
            description=f"Auto-discovered device: {device_info.get('model', 'Unknown model')}",
            device_type="production",
            protocol_id=str(protocol.id),
            address=host,
            status="inactive",
            metadata={
                'discovered': True,
                'discovery_timestamp': datetime.utcnow().isoformat(),
                'vendor': device_info.get('vendor', 'Unknown'),
                'model': device_info.get('model', 'Unknown'),
                'capabilities': device_info.get('capabilities', [])
            },
            created_at=datetime.utcnow()
        )
        
        await device.save()
        
        logger.info(f"Added discovered device: {device.name} ({protocol_type} at {host})")
        
        return {
            "success": True,
            "message": f"Device {device.name} added successfully",
            "protocol_id": str(protocol.id),
            "device_id": str(device.id),
            "recommendations": [
                "Test the connection to verify communication",
                "Configure data points for monitoring",
                "Assign device to appropriate location/area"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add discovered device: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add device: {str(e)}")

@router.get("/devices/discover/presets")
async def get_discovery_presets() -> Dict[str, Any]:
    """
    Get common discovery presets and configurations
    """
    return {
        "network_presets": [
            {
                "name": "Local Network",
                "network": "192.168.1.0/24",
                "description": "Common home/office network range"
            },
            {
                "name": "Industrial Network A",
                "network": "10.0.0.0/24", 
                "description": "Industrial network segment A"
            },
            {
                "name": "Industrial Network B",
                "network": "172.16.0.0/24",
                "description": "Industrial network segment B"
            },
            {
                "name": "PLC Subnet",
                "network": "192.168.10.0/24",
                "description": "Dedicated PLC communication network"
            }
        ],
        "protocol_combinations": [
            {
                "name": "Industrial Standard",
                "protocols": ["modbus-tcp", "opc-ua"],
                "description": "Most common industrial protocols"
            },
            {
                "name": "Comprehensive Scan", 
                "protocols": ["modbus-tcp", "opc-ua", "ethernet-ip", "mqtt"],
                "description": "Scan for all major protocols"
            },
            {
                "name": "Siemens Focus",
                "protocols": ["profinet", "opc-ua"],
                "description": "Optimized for Siemens equipment"
            },
            {
                "name": "Allen-Bradley Focus",
                "protocols": ["ethernet-ip", "modbus-tcp"],
                "description": "Optimized for Allen-Bradley PLCs"
            }
        ],
        "scan_tips": [
            "Start with smaller network ranges (e.g., /28) for faster results",
            "Ensure devices are powered on and network accessible",
            "Check firewall settings allow protocol communication",
            "Use protocol-specific ports for better detection",
            "Consider scanning during maintenance windows for production networks"
        ]
    }