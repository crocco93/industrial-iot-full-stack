import asyncio
import logging
import struct
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from pycomm3 import LogixDriver, SLCDriver
    from pycomm3.exceptions import CommError
    ETHERNETIP_AVAILABLE = True
except ImportError:
    ETHERNETIP_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class EthernetIpService(BaseProtocolService):
    """EtherNet/IP protocol service - Real implementation using pycomm3"""
    
    def __init__(self):
        super().__init__("ethernet-ip")
        self.drivers: Dict[str, LogixDriver] = {}
        self.device_info: Dict[str, Dict] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start EtherNet/IP protocol"""
        if not ETHERNETIP_AVAILABLE:
            logger.error("pycomm3 library not available")
            return False
        
        try:
            target_host = configuration.get("targetHost", "192.168.1.100")
            target_port = configuration.get("targetPort", 44818)
            plc_type = configuration.get("plcType", "logix")  # logix, slc, micrologix
            timeout = configuration.get("timeout", 10.0)
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting EtherNet/IP connection to {target_host}:{target_port}",
                {"target_host": target_host, "target_port": target_port, "plc_type": plc_type}
            )
            
            # Create appropriate driver based on PLC type
            if plc_type.lower() in ['logix', 'controllogix', 'compactlogix']:
                driver = LogixDriver(target_host, port=target_port)
            elif plc_type.lower() in ['slc', 'micrologix']:
                driver = SLCDriver(target_host, port=target_port)
            else:
                driver = LogixDriver(target_host, port=target_port)  # Default to Logix
            
            # Set timeout
            driver.connection_size = 504  # Standard connection size
            
            # Test connection by opening it
            try:
                driver.open()
                
                # Get device information
                device_info = {}
                try:
                    if hasattr(driver, 'get_plc_info'):
                        info = driver.get_plc_info()
                        if info:
                            device_info = {
                                "vendor": getattr(info, 'vendor', 'Unknown'),
                                "product_type": getattr(info, 'product_type', 'Unknown'),
                                "product_code": getattr(info, 'product_code', 0),
                                "version": getattr(info, 'version', 'Unknown'),
                                "serial": getattr(info, 'serial', 'Unknown')
                            }
                except Exception as e:
                    logger.warning(f"Could not get device info: {e}")
                    device_info = {"status": "connected", "info": "Limited device info"}
                
                # Store connection
                self.drivers[protocol_id] = driver
                self.device_info[protocol_id] = device_info
                
            except Exception as e:
                logger.error(f"EtherNet/IP connection failed: {e}")
                return False
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "target_host": target_host,
                "target_port": target_port,
                "plc_type": plc_type,
                "status": "connected",
                "device_info": device_info,
                "last_activity": datetime.utcnow(),
                "tags_read": 0,
                "tags_written": 0,
                "base_throughput": 5000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"EtherNet/IP connection established to {plc_type} PLC"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start EtherNet/IP: {str(e)}"
            )
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop EtherNet/IP protocol"""
        try:
            if protocol_id in self.drivers:
                driver = self.drivers[protocol_id]
                try:
                    driver.close()
                except:
                    pass
                del self.drivers[protocol_id]
            
            if protocol_id in self.device_info:
                del self.device_info[protocol_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "EtherNet/IP connection closed"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping EtherNet/IP: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test EtherNet/IP connection"""
        if not ETHERNETIP_AVAILABLE:
            return False
        
        try:
            target_host = configuration.get("targetHost", address.split(':')[0])
            target_port = configuration.get("targetPort", 44818)
            plc_type = configuration.get("plcType", "logix")
            
            if plc_type.lower() in ['logix', 'controllogix', 'compactlogix']:
                driver = LogixDriver(target_host, port=target_port)
            else:
                driver = SLCDriver(target_host, port=target_port)
            
            try:
                driver.open()
                # Try to read a simple tag or perform basic communication
                driver.close()
                return True
            except Exception:
                try:
                    driver.close()
                except:
                    pass
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read EtherNet/IP tag"""
        if not ETHERNETIP_AVAILABLE:
            raise Exception("EtherNet/IP library not available")
        
        try:
            if connection_id not in self.drivers:
                raise Exception("Connection not active")
            
            driver = self.drivers[connection_id]
            connection = self.active_connections[connection_id]
            
            tag_name = data_point_config.get("tagName", "TestTag")
            data_type = data_point_config.get("dataType", "DINT")
            
            # Read tag value
            result = await asyncio.to_thread(driver.read, tag_name)
            
            if result.error:
                raise Exception(f"Read error: {result.error}")
            
            # Update statistics
            connection["tags_read"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            return {
                "value": result.value,
                "tag_name": tag_name,
                "data_type": result.type if hasattr(result, 'type') else data_type,
                "status": "Good",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"EtherNet/IP read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write EtherNet/IP tag"""
        if not ETHERNETIP_AVAILABLE:
            raise Exception("EtherNet/IP library not available")
        
        try:
            if connection_id not in self.drivers:
                raise Exception("Connection not active")
            
            driver = self.drivers[connection_id]
            connection = self.active_connections[connection_id]
            
            tag_name = data_point_config.get("tagName", "TestTag")
            data_type = data_point_config.get("dataType", "DINT")
            
            # Write tag value
            result = await asyncio.to_thread(driver.write, (tag_name, value, data_type))
            
            if result.error:
                raise Exception(f"Write error: {result.error}")
            
            # Update statistics
            connection["tags_written"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"EtherNet/IP write: {tag_name} = {value}",
                {"tag_name": tag_name, "value": value, "data_type": data_type}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"EtherNet/IP write error: {str(e)}"
            )
            return False
    
    async def read_multiple_tags(self, connection_id: str, tag_list: List[Dict]) -> List[Dict]:
        """Read multiple tags in a single request"""
        try:
            if connection_id not in self.drivers:
                raise Exception("Connection not active")
            
            driver = self.drivers[connection_id]
            
            # Prepare tag names list
            tags = [tag.get("tagName") for tag in tag_list]
            
            # Read multiple tags
            results = await asyncio.to_thread(driver.read, *tags)
            
            # Process results
            response = []
            for i, result in enumerate(results):
                tag_config = tag_list[i] if i < len(tag_list) else {}
                response.append({
                    "tag_name": tags[i],
                    "value": result.value if not result.error else None,
                    "data_type": result.type if hasattr(result, 'type') else "Unknown",
                    "status": "Good" if not result.error else "Error",
                    "error": result.error if result.error else None,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            return response
            
        except Exception as e:
            raise Exception(f"EtherNet/IP multi-read error: {str(e)}")
    
    async def write_multiple_tags(self, connection_id: str, tag_data: List[Dict]) -> bool:
        """Write multiple tags in a single request"""
        try:
            if connection_id not in self.drivers:
                raise Exception("Connection not active")
            
            driver = self.drivers[connection_id]
            
            # Prepare write data
            writes = []
            for tag in tag_data:
                writes.append((
                    tag.get("tagName"),
                    tag.get("value"),
                    tag.get("dataType", "DINT")
                ))
            
            # Write multiple tags
            results = await asyncio.to_thread(driver.write, *writes)
            
            # Check for errors
            errors = [result.error for result in results if result.error]
            
            if errors:
                raise Exception(f"Write errors: {', '.join(errors)}")
            
            await self._log_protocol_event(
                connection_id, "info",
                f"EtherNet/IP multi-write: {len(tag_data)} tags written successfully"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"EtherNet/IP multi-write error: {str(e)}"
            )
            return False
    
    async def get_tag_list(self, connection_id: str, program: str = None) -> List[Dict]:
        """Get available tags from PLC"""
        try:
            if connection_id not in self.drivers:
                raise Exception("Connection not active")
            
            driver = self.drivers[connection_id]
            
            # Get tag list (if supported)
            try:
                if hasattr(driver, 'get_tag_list'):
                    tags = await asyncio.to_thread(driver.get_tag_list, program)
                    
                    result = []
                    for tag in tags:
                        result.append({
                            "name": tag.tag_name if hasattr(tag, 'tag_name') else str(tag),
                            "data_type": tag.data_type if hasattr(tag, 'data_type') else "Unknown",
                            "alias": tag.alias if hasattr(tag, 'alias') else None,
                            "external_access": tag.external_access if hasattr(tag, 'external_access') else None
                        })
                    
                    return result
                else:
                    return [{"info": "Tag listing not supported for this PLC type"}]
                    
            except Exception as e:
                logger.warning(f"Could not get tag list: {e}")
                return [{"error": str(e)}]
                
        except Exception as e:
            raise Exception(f"EtherNet/IP tag list error: {str(e)}")
