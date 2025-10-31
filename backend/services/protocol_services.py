import logging
from typing import Dict, Optional, Any
from models.protocol import ProtocolType
from .base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

# Registry of available protocol services
PROTOCOL_SERVICES: Dict[ProtocolType, BaseProtocolService] = {}

def get_protocol_service(protocol_type: ProtocolType) -> Optional[BaseProtocolService]:
    """Get protocol service instance for the given type"""
    try:
        # Lazy loading of protocol services to avoid circular imports
        if protocol_type not in PROTOCOL_SERVICES:
            service = _load_protocol_service(protocol_type)
            if service:
                PROTOCOL_SERVICES[protocol_type] = service
        
        return PROTOCOL_SERVICES.get(protocol_type)
    
    except Exception as e:
        logger.error(f"Error getting protocol service for {protocol_type}: {e}")
        return None

def _load_protocol_service(protocol_type: ProtocolType) -> Optional[BaseProtocolService]:
    """Dynamically load protocol service based on type - ALL 7 PROTOCOLS SUPPORTED"""
    try:
        if protocol_type == ProtocolType.MODBUS_TCP:
            from .protocols.modbus_service import ModbusTcpService
            return ModbusTcpService()
        
        elif protocol_type == ProtocolType.OPC_UA:
            from .protocols.opcua_service import OpcUaService
            return OpcUaService()
        
        elif protocol_type == ProtocolType.MQTT:
            from .protocols.mqtt_service import MqttService
            return MqttService()
        
        elif protocol_type == ProtocolType.PROFINET:
            from .protocols.profinet_service import ProfinetService
            return ProfinetService()
        
        elif protocol_type == ProtocolType.ETHERNET_IP:
            from .protocols.ethernetip_service import EthernetIpService
            return EthernetIpService()
        
        elif protocol_type == ProtocolType.CANOPEN:
            from .protocols.canopen_service import CANopenService
            return CANopenService()
        
        elif protocol_type == ProtocolType.BACNET:
            from .protocols.bacnet_service import BACnetService
            return BACnetService()
        
        else:
            logger.warning(f"Protocol {protocol_type} not implemented")
            return None
            
    except ImportError as e:
        logger.error(f"Failed to import protocol service for {protocol_type}: {e}")
        return None

# Helper functions
def get_all_available_protocols() -> list:
    """Get list of all available protocol types"""
    return [
        ProtocolType.MODBUS_TCP,
        ProtocolType.OPC_UA,
        ProtocolType.MQTT,
        ProtocolType.PROFINET,
        ProtocolType.ETHERNET_IP,
        ProtocolType.CANOPEN,
        ProtocolType.BACNET
    ]

def get_protocol_service_status() -> Dict[str, dict]:
    """Get status of all protocol services"""
    status = {}
    for protocol_type in get_all_available_protocols():
        try:
            service = get_protocol_service(protocol_type)
            if service:
                status[protocol_type.value] = {
                    "available": True,
                    "service_type": service.__class__.__name__,
                    "protocol_type": service.protocol_type,
                    "is_running": getattr(service, 'is_running', False),
                    "active_connections": len(getattr(service, 'active_connections', {}))
                }
            else:
                status[protocol_type.value] = {
                    "available": False,
                    "error": "Service not available"
                }
        except Exception as e:
            status[protocol_type.value] = {
                "available": False,
                "error": str(e)
            }
    
    return status

async def start_all_protocol_services():
    """Start monitoring for all available protocol services"""
    started_count = 0
    for protocol_type in get_all_available_protocols():
        try:
            service = get_protocol_service(protocol_type)
            if service and hasattr(service, 'start_monitoring'):
                await service.start_monitoring()
                logger.info(f"Started monitoring for {protocol_type.value}")
                started_count += 1
        except Exception as e:
            logger.error(f"Error starting service for {protocol_type.value}: {e}")
    
    logger.info(f"Successfully started {started_count}/{len(get_all_available_protocols())} protocol services")
    return started_count

async def stop_all_protocol_services():
    """Stop monitoring for all protocol services"""
    stopped_count = 0
    for protocol_type in list(PROTOCOL_SERVICES.keys()):
        try:
            service = PROTOCOL_SERVICES[protocol_type]
            if service and hasattr(service, 'stop_monitoring'):
                await service.stop_monitoring()
                logger.info(f"Stopped monitoring for {protocol_type.value}")
                stopped_count += 1
        except Exception as e:
            logger.error(f"Error stopping service for {protocol_type.value}: {e}")
    
    # Clear the registry
    PROTOCOL_SERVICES.clear()
    logger.info(f"Successfully stopped {stopped_count} protocol services")
    return stopped_count

def is_protocol_available(protocol_type: ProtocolType) -> bool:
    """Check if a specific protocol is available"""
    try:
        service = get_protocol_service(protocol_type)
        return service is not None
    except Exception:
        return False

def get_protocol_capabilities(protocol_type: ProtocolType) -> Dict[str, Any]:
    """Get capabilities of a specific protocol"""
    try:
        service = get_protocol_service(protocol_type)
        if not service:
            return {"available": False}
        
        capabilities = {
            "available": True,
            "service_class": service.__class__.__name__,
            "protocol_type": service.protocol_type,
            "supports_read": hasattr(service, 'read_data_point'),
            "supports_write": hasattr(service, 'write_data_point'),
            "supports_test": hasattr(service, 'test_connection'),
            "supports_monitoring": hasattr(service, 'start_monitoring'),
            "active_connections": len(getattr(service, 'active_connections', {}))
        }
        
        return capabilities
        
    except Exception as e:
        return {
            "available": False,
            "error": str(e)
        }
