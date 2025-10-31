import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

try:
    import modbus_tk.defines as modbus_defines
    from modbus_tk import modbus_tcp
    MODBUS_AVAILABLE = True
except ImportError:
    MODBUS_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class ModbusTcpService(BaseProtocolService):
    """Modbus TCP protocol service - Real implementation"""
    
    def __init__(self):
        super().__init__("modbus-tcp")
        self.masters: Dict[str, modbus_tcp.TcpMaster] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start Modbus TCP protocol"""
        if not MODBUS_AVAILABLE:
            logger.error("modbus-tk library not available")
            return False
        
        try:
            host = configuration.get("host", "localhost")
            port = configuration.get("port", 502)
            unit_id = configuration.get("unitId", 1)
            timeout = configuration.get("timeout", 5.0)
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting Modbus TCP connection to {host}:{port}",
                {"host": host, "port": port, "unit_id": unit_id}
            )
            
            # Create Modbus TCP master
            master = modbus_tcp.TcpMaster(host, port)
            master.set_timeout(timeout)
            
            # Test connection
            try:
                # Try to read holding register 0 to test connection
                await asyncio.to_thread(
                    master.execute, 
                    unit_id, 
                    modbus_defines.READ_HOLDING_REGISTERS, 
                    0, 
                    1
                )
            except Exception as e:
                logger.error(f"Modbus connection test failed: {e}")
                master.close()
                return False
            
            self.masters[protocol_id] = master
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "host": host,
                "port": port,
                "unit_id": unit_id,
                "timeout": timeout,
                "status": "connected",
                "last_activity": datetime.utcnow(),
                "base_throughput": 1000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"Modbus TCP connection established successfully"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start Modbus TCP: {str(e)}"
            )
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop Modbus TCP protocol"""
        try:
            if protocol_id in self.masters:
                master = self.masters[protocol_id]
                master.close()
                del self.masters[protocol_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "Modbus TCP connection stopped"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping Modbus TCP: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test Modbus TCP connection"""
        if not MODBUS_AVAILABLE:
            return False
        
        try:
            host = configuration.get("host", address)
            port = configuration.get("port", 502)
            unit_id = configuration.get("unitId", 1)
            timeout = configuration.get("timeout", 5.0)
            
            master = modbus_tcp.TcpMaster(host, port)
            master.set_timeout(timeout)
            
            try:
                # Test with a simple read operation
                await asyncio.to_thread(
                    master.execute,
                    unit_id,
                    modbus_defines.READ_HOLDING_REGISTERS,
                    0,
                    1
                )
                master.close()
                return True
            except Exception:
                master.close()
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read Modbus register"""
        if not MODBUS_AVAILABLE:
            raise Exception("Modbus library not available")
        
        try:
            if connection_id not in self.masters:
                raise Exception("Connection not active")
            
            master = self.masters[connection_id]
            connection = self.active_connections[connection_id]
            
            function_code = data_point_config.get("functionCode", 3)  # Read Holding Registers
            register_address = data_point_config.get("registerAddress", 0)
            register_count = data_point_config.get("registerCount", 1)
            unit_id = connection.get("unit_id", 1)
            data_type = data_point_config.get("dataType", "integer")
            
            # Map function codes to modbus_tk functions
            if function_code == 1:
                modbus_function = modbus_defines.READ_COILS
            elif function_code == 2:
                modbus_function = modbus_defines.READ_DISCRETE_INPUTS
            elif function_code == 3:
                modbus_function = modbus_defines.READ_HOLDING_REGISTERS
            elif function_code == 4:
                modbus_function = modbus_defines.READ_INPUT_REGISTERS
            else:
                raise Exception(f"Unsupported function code: {function_code}")
            
            # Execute read operation
            result = await asyncio.to_thread(
                master.execute,
                unit_id,
                modbus_function,
                register_address,
                register_count
            )
            
            # Update connection activity
            connection["last_activity"] = datetime.utcnow()
            
            # Process result based on data type
            if function_code in [1, 2]:  # Coils/Discrete Inputs
                return bool(result[0]) if result else False
            else:  # Holding/Input Registers
                if data_type == "float" and len(result) >= 2:
                    # Combine two registers for float (IEEE 754)
                    combined = (result[0] << 16) | result[1]
                    return float(combined)
                elif data_type == "integer":
                    return int(result[0]) if result else 0
                else:
                    return result[0] if result else 0
            
        except Exception as e:
            raise Exception(f"Modbus read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write to Modbus register"""
        if not MODBUS_AVAILABLE:
            raise Exception("Modbus library not available")
        
        try:
            if connection_id not in self.masters:
                raise Exception("Connection not active")
            
            master = self.masters[connection_id]
            connection = self.active_connections[connection_id]
            
            function_code = data_point_config.get("functionCode", 6)  # Write Single Register
            register_address = data_point_config.get("registerAddress", 0)
            unit_id = connection.get("unit_id", 1)
            
            if function_code == 5:  # Write Single Coil
                modbus_function = modbus_defines.WRITE_SINGLE_COIL
                write_value = 0xFF00 if value else 0x0000
            elif function_code == 6:  # Write Single Register
                modbus_function = modbus_defines.WRITE_SINGLE_REGISTER
                write_value = int(value)
            elif function_code == 15:  # Write Multiple Coils
                modbus_function = modbus_defines.WRITE_MULTIPLE_COILS
                write_value = [bool(v) for v in (value if isinstance(value, list) else [value])]
            elif function_code == 16:  # Write Multiple Registers
                modbus_function = modbus_defines.WRITE_MULTIPLE_REGISTERS
                write_value = value if isinstance(value, list) else [int(value)]
            else:
                raise Exception(f"Unsupported write function code: {function_code}")
            
            # Execute write operation
            await asyncio.to_thread(
                master.execute,
                unit_id,
                modbus_function,
                register_address,
                len(write_value) if isinstance(write_value, list) else 1,
                write_value
            )
            
            # Update connection activity
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"Modbus write: Register {register_address} = {value}",
                {"function_code": function_code, "register": register_address, "value": value}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"Modbus write error: {str(e)}"
            )
            return False
    
    async def read_coils(self, connection_id: str, start_address: int, count: int) -> list:
        """Read multiple coils"""
        config = {
            "functionCode": 1,
            "registerAddress": start_address,
            "registerCount": count
        }
        result = await self.read_data_point(connection_id, config)
        return result if isinstance(result, list) else [result]
    
    async def read_holding_registers(self, connection_id: str, start_address: int, count: int) -> list:
        """Read multiple holding registers"""
        config = {
            "functionCode": 3,
            "registerAddress": start_address,
            "registerCount": count
        }
        result = await self.read_data_point(connection_id, config)
        return result if isinstance(result, list) else [result]
    
    async def write_single_coil(self, connection_id: str, address: int, value: bool) -> bool:
        """Write single coil"""
        config = {
            "functionCode": 5,
            "registerAddress": address
        }
        return await self.write_data_point(connection_id, config, value)
    
    async def write_single_register(self, connection_id: str, address: int, value: int) -> bool:
        """Write single register"""
        config = {
            "functionCode": 6,
            "registerAddress": address
        }
        return await self.write_data_point(connection_id, config, value)
