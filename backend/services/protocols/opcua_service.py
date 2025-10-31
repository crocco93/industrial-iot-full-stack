import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from asyncua import Client, ua
    from asyncua.common.node import Node
    OPCUA_AVAILABLE = True
except ImportError:
    OPCUA_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class OpcUaService(BaseProtocolService):
    """OPC-UA protocol service - Real implementation"""
    
    def __init__(self):
        super().__init__("opc-ua")
        self.clients: Dict[str, Client] = {}
        self.sessions: Dict[str, Dict] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start OPC-UA protocol"""
        if not OPCUA_AVAILABLE:
            logger.error("asyncua library not available")
            return False
        
        try:
            endpoint_url = configuration.get("endpointUrl", "opc.tcp://localhost:4840")
            username = configuration.get("username")
            password = configuration.get("password")
            security_policy = configuration.get("securityPolicy", "None")
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting OPC-UA connection to {endpoint_url}",
                {"endpoint": endpoint_url, "security_policy": security_policy}
            )
            
            # Create OPC-UA client
            client = Client(endpoint_url)
            
            # Set security policy
            if security_policy != "None":
                await client.set_security_string(f"Basic256Sha256,SignAndEncrypt,{security_policy}")
            
            # Set authentication
            if username and password:
                client.set_user(username)
                client.set_password(password)
            
            # Connect to server
            await client.connect()
            
            # Store client
            self.clients[protocol_id] = client
            
            # Get session info
            session_id = f"session_{protocol_id}"
            self.sessions[session_id] = {
                "protocol_id": protocol_id,
                "created_at": datetime.utcnow(),
                "endpoint_url": endpoint_url
            }
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "endpoint_url": endpoint_url,
                "session_id": session_id,
                "status": "connected",
                "last_activity": datetime.utcnow(),
                "subscriptions": {},
                "base_throughput": 2000  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"OPC-UA session created: {session_id}"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start OPC-UA: {str(e)}"
            )
            if protocol_id in self.clients:
                try:
                    await self.clients[protocol_id].disconnect()
                except:
                    pass
                del self.clients[protocol_id]
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop OPC-UA protocol"""
        try:
            if protocol_id in self.clients:
                client = self.clients[protocol_id]
                await client.disconnect()
                del self.clients[protocol_id]
            
            # Clean up sessions
            connection = self.active_connections.get(protocol_id, {})
            session_id = connection.get("session_id")
            if session_id and session_id in self.sessions:
                del self.sessions[session_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "OPC-UA session closed"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping OPC-UA: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test OPC-UA connection"""
        if not OPCUA_AVAILABLE:
            return False
        
        try:
            endpoint_url = configuration.get("endpointUrl", address)
            
            client = Client(endpoint_url)
            try:
                await client.connect()
                await client.disconnect()
                return True
            except Exception:
                return False
                
        except Exception:
            return False
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read OPC-UA node value"""
        if not OPCUA_AVAILABLE:
            raise Exception("OPC-UA library not available")
        
        try:
            if connection_id not in self.clients:
                raise Exception("Session not active")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            node_id = data_point_config.get("nodeId", "ns=2;i=2")
            
            # Get node
            node = client.get_node(node_id)
            
            # Read value
            value = await node.read_value()
            
            # Read additional attributes
            status_code = await node.read_attribute(ua.AttributeIds.StatusCode)
            source_timestamp = await node.read_attribute(ua.AttributeIds.SourceTimestamp)
            server_timestamp = await node.read_attribute(ua.AttributeIds.ServerTimestamp)
            
            # Update connection activity
            connection["last_activity"] = datetime.utcnow()
            
            # Convert OPC-UA types to Python types
            if hasattr(value, 'Value'):
                value = value.Value
            
            return {
                "value": value,
                "status_code": str(status_code.Value) if hasattr(status_code, 'Value') else "Good",
                "source_timestamp": source_timestamp.Value.isoformat() if hasattr(source_timestamp, 'Value') and source_timestamp.Value else datetime.utcnow().isoformat(),
                "server_timestamp": server_timestamp.Value.isoformat() if hasattr(server_timestamp, 'Value') and server_timestamp.Value else datetime.utcnow().isoformat(),
                "node_id": node_id
            }
            
        except Exception as e:
            raise Exception(f"OPC-UA read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write OPC-UA node value"""
        if not OPCUA_AVAILABLE:
            raise Exception("OPC-UA library not available")
        
        try:
            if connection_id not in self.clients:
                raise Exception("Session not active")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            node_id = data_point_config.get("nodeId", "ns=2;i=2")
            
            # Get node
            node = client.get_node(node_id)
            
            # Write value
            await node.write_value(value)
            
            # Update connection activity
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"OPC-UA write: Node {node_id} = {value}",
                {"node_id": node_id, "value": value}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"OPC-UA write error: {str(e)}"
            )
            return False
    
    async def browse_nodes(self, connection_id: str, node_id: str = None) -> List[Dict]:
        """Browse OPC-UA nodes"""
        if not OPCUA_AVAILABLE:
            raise Exception("OPC-UA library not available")
        
        try:
            if connection_id not in self.clients:
                raise Exception("Session not active")
            
            client = self.clients[connection_id]
            
            # Start from root if no node specified
            if node_id is None:
                node = client.get_root_node()
            else:
                node = client.get_node(node_id)
            
            # Browse children
            children = await node.get_children()
            
            result = []
            for child in children:
                try:
                    # Get node attributes
                    browse_name = await child.read_browse_name()
                    display_name = await child.read_display_name()
                    node_class = await child.read_node_class()
                    data_type = None
                    access_level = None
                    
                    # Get additional info for variables
                    if node_class == ua.NodeClass.Variable:
                        try:
                            data_type = await child.read_data_type()
                            access_level = await child.read_attribute(ua.AttributeIds.AccessLevel)
                        except:
                            pass
                    
                    result.append({
                        "node_id": child.nodeid.to_string(),
                        "browse_name": browse_name.Name,
                        "display_name": display_name.Text,
                        "node_class": node_class.name,
                        "data_type": data_type.to_string() if data_type else None,
                        "access_level": access_level.Value if hasattr(access_level, 'Value') else None
                    })
                except Exception as e:
                    logger.warning(f"Error reading node attributes: {e}")
                    continue
            
            return result
            
        except Exception as e:
            raise Exception(f"OPC-UA browse error: {str(e)}")
