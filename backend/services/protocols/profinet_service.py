import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    import snap7
    from snap7.util import *
    PROFINET_AVAILABLE = True
except ImportError:
    PROFINET_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class ProfinetService(BaseProtocolService):
    """Profinet protocol service - Real implementation using snap7"""
    
    def __init__(self):
        super().__init__("profinet")
        self.clients: Dict[str, snap7.client.Client] = {}
        self.device_info: Dict[str, Dict] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start Profinet protocol"""
        if not PROFINET_AVAILABLE:
            logger.error("snap7 library not available")
            return False
        
        try:
            ip_address = configuration.get("ipAddress", "192.168.1.100")
            rack = configuration.get("rack", 0)
            slot = configuration.get("slot", 1)
            port = configuration.get("port", 102)
            device_name = configuration.get("deviceName", "PLC-Device")
            connection_type = configuration.get("connectionType", "PG")  # PG, OP, or S7_BASIC
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting Profinet connection to {device_name} at {ip_address}",
                {"device_name": device_name, "ip_address": ip_address, "rack": rack, "slot": slot}
            )
            
            # Create S7 client
            client = snap7.client.Client()
            
            # Configure connection type
            if connection_type == "PG":
                client.set_connection_type(0x01)  # PG connection
            elif connection_type == "OP":
                client.set_connection_type(0x02)  # OP connection
            else:
                client.set_connection_type(0x03)  # S7 Basic connection
            
            # Set connection parameters
            client.set_connection_params(ip_address, 0x100, 0x200)  # Local/Remote TSAP
            
            try:
                # Connect to PLC
                await asyncio.to_thread(client.connect, ip_address, rack, slot, port)
                
                if not client.get_connected():
                    raise Exception("Failed to establish connection")
                
                # Get PLC information
                cpu_info = {}
                try:
                    cpu_info_raw = await asyncio.to_thread(client.get_cpu_info)
                    if cpu_info_raw:
                        cpu_info = {
                            "module_type_name": cpu_info_raw.ModuleTypeName.decode('utf-8', errors='ignore'),
                            "serial_number": cpu_info_raw.SerialNumber.decode('utf-8', errors='ignore'),
                            "as_name": cpu_info_raw.ASName.decode('utf-8', errors='ignore'),
                            "copyright": cpu_info_raw.Copyright.decode('utf-8', errors='ignore'),
                            "module_name": cpu_info_raw.ModuleName.decode('utf-8', errors='ignore')
                        }
                except Exception as e:
                    logger.warning(f"Could not get CPU info: {e}")
                    cpu_info = {"status": "connected", "info": "Limited device info"}
                
                # Store client and device info
                self.clients[protocol_id] = client
                self.device_info[protocol_id] = {
                    "device_name": device_name,
                    "ip_address": ip_address,
                    "rack": rack,
                    "slot": slot,
                    "cpu_info": cpu_info,
                    "connection_type": connection_type
                }
                
            except Exception as e:
                logger.error(f"Profinet connection failed: {e}")
                client.disconnect()
                return False
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "device_name": device_name,
                "ip_address": ip_address,
                "rack": rack,
                "slot": slot,
                "port": port,
                "connection_type": connection_type,
                "status": "connected",
                "cpu_info": cpu_info,
                "last_activity": datetime.utcnow(),
                "db_reads": 0,
                "db_writes": 0,
                "base_throughput": 8000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"Profinet connection established to {device_name}"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start Profinet: {str(e)}"
            )
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop Profinet protocol"""
        try:
            if protocol_id in self.clients:
                client = self.clients[protocol_id]
                try:
                    await asyncio.to_thread(client.disconnect)
                except Exception as e:
                    logger.warning(f"Error disconnecting Profinet client: {e}")
                
                del self.clients[protocol_id]
            
            if protocol_id in self.device_info:
                del self.device_info[protocol_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "Profinet connection closed"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping Profinet: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test Profinet connection"""
        if not PROFINET_AVAILABLE:
            return False
        
        try:
            ip_address = configuration.get("ipAddress", address.split(':')[0])
            rack = configuration.get("rack", 0)
            slot = configuration.get("slot", 1)
            port = configuration.get("port", 102)
            
            test_client = snap7.client.Client()
            
            try:
                test_client.connect(ip_address, rack, slot, port)
                connected = test_client.get_connected()
                test_client.disconnect()
                return connected
            except Exception:
                try:
                    test_client.disconnect()
                except:
                    pass
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read Profinet data block"""
        if not PROFINET_AVAILABLE:
            raise Exception("Profinet library not available")
        
        try:
            if connection_id not in self.clients:
                raise Exception("Profinet client not connected")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            area = data_point_config.get("area", "DB")  # DB, MK, PE, PA, CT, TM
            db_number = data_point_config.get("dbNumber", 1)
            start = data_point_config.get("start", 0)
            size = data_point_config.get("size", 4)
            data_type = data_point_config.get("dataType", "REAL")
            
            # Read data based on area
            if area == "DB":
                # Data Block
                data = await asyncio.to_thread(client.db_read, db_number, start, size)
            elif area == "MK":
                # Merker (Memory)
                data = await asyncio.to_thread(client.mb_read, start, size)
            elif area == "PE":
                # Process Input
                data = await asyncio.to_thread(client.eb_read, start, size)
            elif area == "PA":
                # Process Output
                data = await asyncio.to_thread(client.ab_read, start, size)
            else:
                raise Exception(f"Unsupported area: {area}")
            
            # Convert data based on type
            if data_type == "BOOL":
                bit = data_point_config.get("bit", 0)
                value = get_bool(data, 0, bit)
            elif data_type == "BYTE":
                value = get_int(data, 0)
            elif data_type == "WORD":
                value = get_word(data, 0)
            elif data_type == "DWORD":
                value = get_dword(data, 0)
            elif data_type == "INT":
                value = get_int(data, 0)
            elif data_type == "DINT":
                value = get_dint(data, 0)
            elif data_type == "REAL":
                value = get_real(data, 0)
            elif data_type == "STRING":
                max_len = data_point_config.get("maxLength", size - 2)
                value = get_string(data, 0, max_len)
            else:
                # Return raw bytes
                value = data.hex()
            
            # Update statistics
            connection["db_reads"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            return {
                "value": value,
                "area": area,
                "db_number": db_number if area == "DB" else None,
                "address": start,
                "size": size,
                "data_type": data_type,
                "raw_data": data.hex(),
                "status": "Success",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Profinet read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write Profinet data block"""
        if not PROFINET_AVAILABLE:
            raise Exception("Profinet library not available")
        
        try:
            if connection_id not in self.clients:
                raise Exception("Profinet client not connected")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            area = data_point_config.get("area", "DB")
            db_number = data_point_config.get("dbNumber", 1)
            start = data_point_config.get("start", 0)
            data_type = data_point_config.get("dataType", "REAL")
            
            # Prepare data buffer based on type
            if data_type == "BOOL":
                bit = data_point_config.get("bit", 0)
                # Read current byte, modify bit, write back
                current_data = await asyncio.to_thread(client.db_read, db_number, start, 1)
                set_bool(current_data, 0, bit, bool(value))
                data = current_data
                
            elif data_type == "BYTE":
                data = bytearray(1)
                set_int(data, 0, int(value))
                
            elif data_type == "WORD":
                data = bytearray(2)
                set_word(data, 0, int(value))
                
            elif data_type == "DWORD":
                data = bytearray(4)
                set_dword(data, 0, int(value))
                
            elif data_type == "INT":
                data = bytearray(2)
                set_int(data, 0, int(value))
                
            elif data_type == "DINT":
                data = bytearray(4)
                set_dint(data, 0, int(value))
                
            elif data_type == "REAL":
                data = bytearray(4)
                set_real(data, 0, float(value))
                
            elif data_type == "STRING":
                max_len = data_point_config.get("maxLength", 254)
                data = bytearray(max_len + 2)  # +2 for length bytes
                set_string(data, 0, str(value), max_len)
                
            else:
                # Raw bytes
                if isinstance(value, str):
                    data = bytearray.fromhex(value)
                else:
                    data = bytearray(value)
            
            # Write data based on area
            if area == "DB":
                await asyncio.to_thread(client.db_write, db_number, start, data)
            elif area == "MK":
                await asyncio.to_thread(client.mb_write, start, data)
            elif area == "PE":
                await asyncio.to_thread(client.eb_write, start, data)
            elif area == "PA":
                await asyncio.to_thread(client.ab_write, start, data)
            else:
                raise Exception(f"Unsupported area: {area}")
            
            # Update statistics
            connection["db_writes"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"Profinet write: {area}{db_number if area == 'DB' else ''}.{start} = {value}",
                {
                    "area": area,
                    "db_number": db_number if area == "DB" else None,
                    "address": start,
                    "value": value,
                    "data_type": data_type
                }
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"Profinet write error: {str(e)}"
            )
            return False
    
    async def read_data_block(self, connection_id: str, db_number: int, start: int, size: int) -> bytes:
        """Read complete data block"""
        try:
            if connection_id not in self.clients:
                raise Exception("Profinet client not connected")
            
            client = self.clients[connection_id]
            
            data = await asyncio.to_thread(client.db_read, db_number, start, size)
            return data
            
        except Exception as e:
            raise Exception(f"Profinet DB read error: {str(e)}")
    
    async def write_data_block(self, connection_id: str, db_number: int, start: int, data: bytes) -> bool:
        """Write complete data block"""
        try:
            if connection_id not in self.clients:
                raise Exception("Profinet client not connected")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            await asyncio.to_thread(client.db_write, db_number, start, data)
            
            connection["db_writes"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"Profinet DB write: DB{db_number}.{start}, {len(data)} bytes"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"Profinet DB write error: {str(e)}"
            )
            return False
    
    async def get_plc_status(self, connection_id: str) -> Dict[str, Any]:
        """Get PLC CPU status"""
        try:
            if connection_id not in self.clients:
                raise Exception("Profinet client not connected")
            
            client = self.clients[connection_id]
            
            # Get CPU status
            cpu_state = await asyncio.to_thread(client.get_cpu_state)
            
            status_map = {
                0: "Unknown",
                4: "Stop",
                8: "Run"
            }
            
            return {
                "cpu_state": status_map.get(cpu_state, f"Unknown({cpu_state})"),
                "cpu_state_code": cpu_state,
                "connected": client.get_connected(),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Profinet status error: {str(e)}")
