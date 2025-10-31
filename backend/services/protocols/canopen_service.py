import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    import canopen
    import can
    CANOPEN_AVAILABLE = True
except ImportError:
    CANOPEN_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class CANopenService(BaseProtocolService):
    """CANopen protocol service - Real implementation using canopen library"""
    
    def __init__(self):
        super().__init__("canopen")
        self.networks: Dict[str, canopen.Network] = {}
        self.nodes: Dict[str, Dict[int, canopen.RemoteNode]] = {}
        self.eds_cache: Dict[str, str] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start CANopen protocol"""
        if not CANOPEN_AVAILABLE:
            logger.error("canopen library not available")
            return False
        
        try:
            bustype = configuration.get("bustype", "socketcan")
            channel = configuration.get("channel", "can0")
            bitrate = configuration.get("bitrate", 250000)
            node_id = configuration.get("nodeId", 1)
            eds_file = configuration.get("edsFile", None)
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting CANopen Master Node {node_id} on {channel} at {bitrate} baud",
                {"node_id": node_id, "bitrate": bitrate, "channel": channel, "bustype": bustype}
            )
            
            # Create CAN bus interface
            try:
                if bustype == "socketcan":
                    bus = can.interface.Bus(channel=channel, bustype=bustype, bitrate=bitrate)
                elif bustype == "virtual":
                    bus = can.interface.Bus(channel=channel, bustype=bustype)
                else:
                    bus = can.interface.Bus(channel=channel, bustype=bustype, bitrate=bitrate)
                    
            except Exception as e:
                logger.error(f"Failed to create CAN bus: {e}")
                return False
            
            # Create CANopen network
            network = canopen.Network()
            network.bus = bus
            
            # Connect to network
            try:
                network.connect()
            except Exception as e:
                logger.error(f"Failed to connect to CANopen network: {e}")
                bus.shutdown()
                return False
            
            # Store network
            self.networks[protocol_id] = network
            self.nodes[protocol_id] = {}
            
            # Add master node if EDS file provided
            if eds_file and node_id:
                try:
                    master_node = network.add_node(node_id, eds_file)
                    self.nodes[protocol_id][node_id] = master_node
                    self.eds_cache[f"{protocol_id}_{node_id}"] = eds_file
                except Exception as e:
                    logger.warning(f"Could not add master node: {e}")
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "bustype": bustype,
                "channel": channel,
                "bitrate": bitrate,
                "node_id": node_id,
                "eds_file": eds_file,
                "status": "connected",
                "last_activity": datetime.utcnow(),
                "nodes_discovered": len(self.nodes[protocol_id]),
                "sdo_requests": 0,
                "pdo_messages": 0,
                "base_throughput": 1000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"CANopen network connected on {channel}"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start CANopen: {str(e)}"
            )
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop CANopen protocol"""
        try:
            if protocol_id in self.networks:
                network = self.networks[protocol_id]
                try:
                    network.disconnect()
                    if hasattr(network, 'bus') and network.bus:
                        network.bus.shutdown()
                except Exception as e:
                    logger.warning(f"Error disconnecting CANopen network: {e}")
                
                del self.networks[protocol_id]
            
            if protocol_id in self.nodes:
                del self.nodes[protocol_id]
            
            # Clean up EDS cache for this protocol
            cache_keys_to_remove = [key for key in self.eds_cache.keys() if key.startswith(f"{protocol_id}_")]
            for key in cache_keys_to_remove:
                del self.eds_cache[key]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "CANopen network disconnected"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping CANopen: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test CANopen connection"""
        if not CANOPEN_AVAILABLE:
            return False
        
        try:
            bustype = configuration.get("bustype", "virtual")  # Use virtual for testing
            channel = configuration.get("channel", "test")
            
            try:
                # Create test bus
                test_bus = can.interface.Bus(channel=channel, bustype=bustype)
                test_network = canopen.Network()
                test_network.bus = test_bus
                
                # Test connection
                test_network.connect()
                test_network.disconnect()
                test_bus.shutdown()
                
                return True
            except Exception:
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read CANopen object dictionary entry via SDO"""
        if not CANOPEN_AVAILABLE:
            raise Exception("CANopen library not available")
        
        try:
            if connection_id not in self.networks:
                raise Exception("CANopen network not connected")
            
            network = self.networks[connection_id]
            connection = self.active_connections[connection_id]
            
            node_id = data_point_config.get("nodeId", 1)
            index = data_point_config.get("index", 0x1000)  # Device type
            subindex = data_point_config.get("subindex", 0)
            data_type = data_point_config.get("dataType", "UNSIGNED32")
            
            # Get or create node
            if node_id not in self.nodes[connection_id]:
                # Try to add node (may need EDS file for complex operations)
                try:
                    node = network.add_node(node_id)
                    self.nodes[connection_id][node_id] = node
                except Exception as e:
                    logger.warning(f"Could not add node {node_id}: {e}")
                    # Create basic remote node
                    node = canopen.RemoteNode(node_id, network.object_dictionary)
                    self.nodes[connection_id][node_id] = node
            else:
                node = self.nodes[connection_id][node_id]
            
            # Perform SDO read
            try:
                value = await asyncio.to_thread(node.sdo.upload, index, subindex)
                
                # Update statistics
                connection["sdo_requests"] += 1
                connection["last_activity"] = datetime.utcnow()
                
                return {
                    "value": value,
                    "node_id": node_id,
                    "index": hex(index),
                    "subindex": subindex,
                    "data_type": data_type,
                    "status": "Success",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
            except Exception as e:
                raise Exception(f"SDO read failed: {str(e)}")
            
        except Exception as e:
            raise Exception(f"CANopen read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write CANopen object dictionary entry via SDO"""
        if not CANOPEN_AVAILABLE:
            raise Exception("CANopen library not available")
        
        try:
            if connection_id not in self.networks:
                raise Exception("CANopen network not connected")
            
            network = self.networks[connection_id]
            connection = self.active_connections[connection_id]
            
            node_id = data_point_config.get("nodeId", 1)
            index = data_point_config.get("index", 0x2000)
            subindex = data_point_config.get("subindex", 0)
            data_type = data_point_config.get("dataType", "UNSIGNED32")
            
            # Get or create node
            if node_id not in self.nodes[connection_id]:
                try:
                    node = network.add_node(node_id)
                    self.nodes[connection_id][node_id] = node
                except Exception:
                    node = canopen.RemoteNode(node_id, network.object_dictionary)
                    self.nodes[connection_id][node_id] = node
            else:
                node = self.nodes[connection_id][node_id]
            
            # Perform SDO write
            try:
                await asyncio.to_thread(node.sdo.download, index, subindex, value)
                
                # Update statistics
                connection["sdo_requests"] += 1
                connection["last_activity"] = datetime.utcnow()
                
                await self._log_protocol_event(
                    connection_id, "info",
                    f"CANopen SDO write: Node {node_id}, Index {hex(index)}.{subindex} = {value}",
                    {
                        "node_id": node_id,
                        "index": hex(index),
                        "subindex": subindex,
                        "value": value,
                        "data_type": data_type
                    }
                )
                
                return True
                
            except Exception as e:
                raise Exception(f"SDO write failed: {str(e)}")
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"CANopen write error: {str(e)}"
            )
            return False
    
    async def add_node(self, connection_id: str, node_id: int, eds_file: str = None) -> bool:
        """Add a node to the CANopen network"""
        try:
            if connection_id not in self.networks:
                raise Exception("CANopen network not connected")
            
            network = self.networks[connection_id]
            
            if eds_file:
                node = network.add_node(node_id, eds_file)
                self.eds_cache[f"{connection_id}_{node_id}"] = eds_file
            else:
                node = network.add_node(node_id)
            
            self.nodes[connection_id][node_id] = node
            
            # Update connection stats
            connection = self.active_connections[connection_id]
            connection["nodes_discovered"] = len(self.nodes[connection_id])
            
            await self._log_protocol_event(
                connection_id, "info",
                f"CANopen node {node_id} added to network",
                {"node_id": node_id, "eds_file": eds_file}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"Error adding CANopen node: {str(e)}"
            )
            return False
    
    async def node_guard(self, connection_id: str, node_id: int) -> Dict[str, Any]:
        """Perform node guarding on specific node"""
        try:
            if connection_id not in self.networks:
                raise Exception("CANopen network not connected")
            
            if node_id not in self.nodes[connection_id]:
                raise Exception(f"Node {node_id} not found")
            
            node = self.nodes[connection_id][node_id]
            
            # Read node state via heartbeat or node guarding
            try:
                # Try to read device status
                device_status = await asyncio.to_thread(node.sdo.upload, 0x1002, 0)  # Manufacturer status register
                
                return {
                    "node_id": node_id,
                    "status": "operational" if device_status == 0 else "error",
                    "device_status": device_status,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
            except Exception as e:
                return {
                    "node_id": node_id,
                    "status": "communication_error",
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                }
            
        except Exception as e:
            raise Exception(f"CANopen node guard error: {str(e)}")
    
    async def read_object_dictionary(self, connection_id: str, node_id: int) -> List[Dict]:
        """Read available object dictionary entries from node"""
        try:
            if connection_id not in self.networks:
                raise Exception("CANopen network not connected")
            
            if node_id not in self.nodes[connection_id]:
                raise Exception(f"Node {node_id} not found")
            
            node = self.nodes[connection_id][node_id]
            
            # Get object dictionary from node
            od_entries = []
            
            if hasattr(node, 'object_dictionary'):
                od = node.object_dictionary
                
                for index in od:
                    try:
                        obj = od[index]
                        entry = {
                            "index": hex(index),
                            "name": getattr(obj, 'name', f'Object_{hex(index)}'),
                            "object_type": getattr(obj, 'object_type', 'Unknown'),
                            "data_type": getattr(obj, 'data_type', 'Unknown'),
                            "access_type": getattr(obj, 'access_type', 'Unknown'),
                            "subindices": []
                        }
                        
                        # Add subindices if available
                        if hasattr(obj, '__iter__'):
                            for subindex in obj:
                                try:
                                    subobj = obj[subindex]
                                    entry["subindices"].append({
                                        "subindex": subindex,
                                        "name": getattr(subobj, 'name', f'Sub_{subindex}'),
                                        "data_type": getattr(subobj, 'data_type', 'Unknown'),
                                        "access_type": getattr(subobj, 'access_type', 'Unknown')
                                    })
                                except:
                                    continue
                        
                        od_entries.append(entry)
                        
                    except Exception:
                        continue
            
            return od_entries
            
        except Exception as e:
            raise Exception(f"CANopen OD read error: {str(e)}")
