import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from bacpypes.core import run, stop
    from bacpypes.pdu import Address
    from bacpypes.app import BIPSimpleApplication
    from bacpypes.local.device import LocalDeviceObject
    from bacpypes.basetypes import ServicesSupported, PropertyIdentifier
    from bacpypes.primitivedata import Real, Unsigned, Boolean, CharacterString
    from bacpypes.constructeddata import Array
    from bacpypes.apdu import ReadPropertyRequest, WritePropertyRequest
    BACNET_AVAILABLE = True
except ImportError:
    BACNET_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class BACnetService(BaseProtocolService):
    """BACnet protocol service - Real implementation using bacpypes"""
    
    def __init__(self):
        super().__init__("bacnet")
        self.applications: Dict[str, BIPSimpleApplication] = {}
        self.discovered_devices: Dict[str, Dict[int, Dict]] = {}
        self.running_apps: Dict[str, bool] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start BACnet protocol"""
        if not BACNET_AVAILABLE:
            logger.error("bacpypes library not available")
            return False
        
        try:
            device_id = configuration.get("deviceId", 12345)
            device_name = configuration.get("deviceName", "PyBACnet Device")
            local_address = configuration.get("localAddress", "192.168.1.100/24")
            max_apdu_length = configuration.get("maxApduLength", 1476)
            segmentation_supported = configuration.get("segmentationSupported", "segmentedBoth")
            vendor_id = configuration.get("vendorId", 999)
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting BACnet Device {device_id} ({device_name}) on {local_address}",
                {"device_id": device_id, "local_address": local_address, "max_apdu": max_apdu_length}
            )
            
            # Create device object
            device_obj = LocalDeviceObject(
                objectName=device_name,
                objectIdentifier=('device', device_id),
                maxApduLengthAccepted=max_apdu_length,
                segmentationSupported=segmentation_supported,
                vendorIdentifier=vendor_id,
                vendorName="Industrial Protocols Management",
                modelName="IoT BACnet Gateway",
                applicationSoftwareVersion="1.0.0",
                protocolVersion=1,
                protocolRevision=0,
                systemStatus='operational'
            )
            
            # Set up services supported
            services_supported = ServicesSupported()
            services_supported['whoIs'] = 1
            services_supported['iAm'] = 1
            services_supported['readProperty'] = 1
            services_supported['writeProperty'] = 1
            device_obj.protocolServicesSupported = services_supported
            
            # Create application
            try:
                app = BIPSimpleApplication(device_obj, local_address)
                self.applications[protocol_id] = app
                self.running_apps[protocol_id] = True
                
                # Initialize discovered devices storage
                self.discovered_devices[protocol_id] = {}
                
            except Exception as e:
                logger.error(f"Failed to create BACnet application: {e}")
                return False
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "device_id": device_id,
                "device_name": device_name,
                "local_address": local_address,
                "max_apdu_length": max_apdu_length,
                "vendor_id": vendor_id,
                "status": "operational",
                "last_activity": datetime.utcnow(),
                "discovered_devices": 0,
                "read_requests": 0,
                "write_requests": 0,
                "base_throughput": 2000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"BACnet device {device_id} started successfully"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start BACnet: {str(e)}"
            )
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop BACnet protocol"""
        try:
            if protocol_id in self.applications:
                self.running_apps[protocol_id] = False
                # BACnet cleanup
                try:
                    app = self.applications[protocol_id]
                    app.close()
                except Exception as e:
                    logger.warning(f"Error closing BACnet application: {e}")
                
                del self.applications[protocol_id]
            
            if protocol_id in self.discovered_devices:
                del self.discovered_devices[protocol_id]
            
            if protocol_id in self.running_apps:
                del self.running_apps[protocol_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "BACnet device stopped"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping BACnet: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test BACnet connection"""
        if not BACNET_AVAILABLE:
            return False
        
        try:
            # For BACnet, we can try to create a temporary device
            device_id = configuration.get("deviceId", 99999)
            local_address = configuration.get("localAddress", address)
            
            device_obj = LocalDeviceObject(
                objectName="TestDevice",
                objectIdentifier=('device', device_id),
                maxApduLengthAccepted=1476,
                segmentationSupported='segmentedBoth',
                vendorIdentifier=999
            )
            
            try:
                test_app = BIPSimpleApplication(device_obj, local_address)
                test_app.close()
                return True
            except Exception:
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read BACnet object property"""
        if not BACNET_AVAILABLE:
            raise Exception("BACnet library not available")
        
        try:
            if connection_id not in self.applications:
                raise Exception("BACnet application not active")
            
            app = self.applications[connection_id]
            connection = self.active_connections[connection_id]
            
            # Parse data point configuration
            device_address = data_point_config.get("deviceAddress", "192.168.1.100")
            object_type = data_point_config.get("objectType", "analogInput")
            object_instance = data_point_config.get("objectInstance", 0)
            property_id = data_point_config.get("propertyId", "presentValue")
            device_id = data_point_config.get("deviceId", 1234)
            
            # Create read request
            request = ReadPropertyRequest(
                objectIdentifier=(object_type, object_instance),
                propertyIdentifier=property_id
            )
            request.pduDestination = Address(device_address)
            
            try:
                # This is a simplified version - real implementation would need
                # proper async handling of BACnet requests
                response = await asyncio.to_thread(self._sync_read_property, app, request)
                
                # Update statistics
                connection["read_requests"] += 1
                connection["last_activity"] = datetime.utcnow()
                
                return {
                    "value": response,
                    "object_type": object_type,
                    "object_instance": object_instance,
                    "property_id": property_id,
                    "device_address": device_address,
                    "device_id": device_id,
                    "status": "Success",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
            except Exception as e:
                raise Exception(f"BACnet read failed: {str(e)}")
            
        except Exception as e:
            raise Exception(f"BACnet read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write BACnet object property"""
        if not BACNET_AVAILABLE:
            raise Exception("BACnet library not available")
        
        try:
            if connection_id not in self.applications:
                raise Exception("BACnet application not active")
            
            app = self.applications[connection_id]
            connection = self.active_connections[connection_id]
            
            # Parse configuration
            device_address = data_point_config.get("deviceAddress", "192.168.1.100")
            object_type = data_point_config.get("objectType", "analogOutput")
            object_instance = data_point_config.get("objectInstance", 0)
            property_id = data_point_config.get("propertyId", "presentValue")
            priority = data_point_config.get("priority", None)
            
            # Create write request
            request = WritePropertyRequest(
                objectIdentifier=(object_type, object_instance),
                propertyIdentifier=property_id
            )
            request.pduDestination = Address(device_address)
            
            # Set value based on type
            if isinstance(value, bool):
                request.propertyValue = Boolean(value)
            elif isinstance(value, int):
                request.propertyValue = Unsigned(value)
            elif isinstance(value, float):
                request.propertyValue = Real(value)
            elif isinstance(value, str):
                request.propertyValue = CharacterString(value)
            else:
                request.propertyValue = str(value)
            
            if priority is not None:
                request.propertyPriority = priority
            
            try:
                # Perform write operation
                await asyncio.to_thread(self._sync_write_property, app, request)
                
                # Update statistics
                connection["write_requests"] += 1
                connection["last_activity"] = datetime.utcnow()
                
                await self._log_protocol_event(
                    connection_id, "info",
                    f"BACnet write: {object_type}:{object_instance}.{property_id} = {value}",
                    {
                        "object_type": object_type,
                        "object_instance": object_instance,
                        "property_id": property_id,
                        "value": value,
                        "priority": priority
                    }
                )
                
                return True
                
            except Exception as e:
                raise Exception(f"BACnet write failed: {str(e)}")
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"BACnet write error: {str(e)}"
            )
            return False
    
    def _sync_read_property(self, app, request):
        """Synchronous BACnet read property helper"""
        # This is a simplified implementation
        # Real implementation would need proper BACnet request handling
        try:
            response = app.request(request)
            if response:
                return response.propertyValue
            else:
                raise Exception("No response received")
        except Exception as e:
            raise Exception(f"BACnet communication error: {str(e)}")
    
    def _sync_write_property(self, app, request):
        """Synchronous BACnet write property helper"""
        # This is a simplified implementation
        # Real implementation would need proper BACnet request handling
        try:
            response = app.request(request)
            if not response:
                raise Exception("Write confirmation not received")
        except Exception as e:
            raise Exception(f"BACnet communication error: {str(e)}")
    
    async def discover_devices(self, connection_id: str, network_range: str = None) -> List[Dict]:
        """Discover BACnet devices on network"""
        try:
            if connection_id not in self.applications:
                raise Exception("BACnet application not active")
            
            # This would implement Who-Is / I-Am discovery
            # Simplified version returns mock discovered devices
            discovered = []
            
            # In real implementation, this would send Who-Is broadcasts
            # and collect I-Am responses
            
            return discovered
            
        except Exception as e:
            raise Exception(f"BACnet device discovery error: {str(e)}")
    
    async def read_object_list(self, connection_id: str, device_address: str, device_id: int) -> List[Dict]:
        """Read object list from BACnet device"""
        try:
            if connection_id not in self.applications:
                raise Exception("BACnet application not active")
            
            # Read object-list property from device object
            config = {
                "deviceAddress": device_address,
                "objectType": "device",
                "objectInstance": device_id,
                "propertyId": "object-list"
            }
            
            result = await self.read_data_point(connection_id, config)
            
            # Parse object list
            objects = []
            if result and "value" in result:
                # Process object list (simplified)
                objects.append({
                    "type": "device",
                    "instance": device_id,
                    "name": f"Device {device_id}"
                })
            
            return objects
            
        except Exception as e:
            raise Exception(f"BACnet object list error: {str(e)}")
