import asyncio
import json
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

from ..base_protocol import BaseProtocolService

logger = logging.getLogger(__name__)

class MqttService(BaseProtocolService):
    """MQTT protocol service - Real implementation"""
    
    def __init__(self):
        super().__init__("mqtt")
        self.clients: Dict[str, mqtt.Client] = {}
        self.message_callbacks: Dict[str, Callable] = {}
        self.subscribed_topics: Dict[str, Dict[str, Any]] = {}
    
    async def start_protocol(self, protocol_id: str, configuration: Dict[str, Any]) -> bool:
        """Start MQTT protocol"""
        if not MQTT_AVAILABLE:
            logger.error("paho-mqtt library not available")
            return False
        
        try:
            broker_host = configuration.get("brokerHost", "localhost")
            broker_port = configuration.get("brokerPort", 1883)
            client_id = configuration.get("clientId", f"client_{protocol_id}")
            username = configuration.get("username")
            password = configuration.get("password")
            keep_alive = configuration.get("keepAlive", 60)
            qos = configuration.get("qos", 1)
            use_ssl = configuration.get("useSSL", False)
            
            await self._log_protocol_event(
                protocol_id, "info",
                f"Starting MQTT connection to {broker_host}:{broker_port}",
                {"broker_host": broker_host, "broker_port": broker_port, "client_id": client_id}
            )
            
            # Create MQTT client
            client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
            
            # Set authentication if provided
            if username and password:
                client.username_pw_set(username, password)
            
            # Configure SSL if requested
            if use_ssl:
                client.tls_set()
            
            # Set up callbacks
            client.on_connect = self._on_connect
            client.on_disconnect = self._on_disconnect
            client.on_message = self._on_message
            client.on_publish = self._on_publish
            client.on_subscribe = self._on_subscribe
            
            # Store client reference
            self.clients[protocol_id] = client
            client._protocol_id = protocol_id  # Store protocol ID in client
            
            # Connect to broker
            connection_result = await asyncio.to_thread(
                client.connect, broker_host, broker_port, keep_alive
            )
            
            if connection_result != mqtt.MQTT_ERR_SUCCESS:
                raise Exception(f"MQTT connection failed with code: {connection_result}")
            
            # Start the network loop in a separate thread
            client.loop_start()
            
            # Wait for connection to be established
            await asyncio.sleep(1)
            
            if not client.is_connected():
                raise Exception("MQTT client failed to connect")
            
            # Store connection info
            self.active_connections[protocol_id] = {
                "broker_host": broker_host,
                "broker_port": broker_port,
                "client_id": client_id,
                "username": username,
                "keep_alive": keep_alive,
                "qos": qos,
                "status": "connected",
                "last_activity": datetime.utcnow(),
                "subscribed_topics": {},
                "published_messages": 0,
                "received_messages": 0,
                "base_throughput": 500  # bytes per second estimate
            }
            
            await self.start_monitoring()
            await self._log_protocol_event(
                protocol_id, "info",
                f"MQTT client connected: {client_id}"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Failed to start MQTT: {str(e)}"
            )
            if protocol_id in self.clients:
                self.clients[protocol_id].loop_stop()
                del self.clients[protocol_id]
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop MQTT protocol"""
        try:
            if protocol_id in self.clients:
                client = self.clients[protocol_id]
                client.loop_stop()
                client.disconnect()
                del self.clients[protocol_id]
            
            if protocol_id in self.active_connections:
                del self.active_connections[protocol_id]
            
            if not self.active_connections:
                await self.stop_monitoring()
            
            await self._log_protocol_event(
                protocol_id, "info",
                "MQTT client disconnected"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                protocol_id, "error",
                f"Error stopping MQTT: {str(e)}"
            )
            return False
    
    async def test_connection(self, address: str, configuration: Dict[str, Any]) -> bool:
        """Test MQTT connection"""
        if not MQTT_AVAILABLE:
            return False
        
        try:
            broker_host = configuration.get("brokerHost", address.split(':')[0])
            broker_port = configuration.get("brokerPort", 1883)
            username = configuration.get("username")
            password = configuration.get("password")
            
            test_client = mqtt.Client(client_id=f"test_client_{datetime.utcnow().timestamp()}")
            
            if username and password:
                test_client.username_pw_set(username, password)
            
            try:
                result = await asyncio.to_thread(
                    test_client.connect, broker_host, broker_port, 10
                )
                test_client.disconnect()
                return result == mqtt.MQTT_ERR_SUCCESS
            except Exception:
                return False
                
        except Exception:
            return False
    
    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connect callback"""
        protocol_id = getattr(client, '_protocol_id', 'unknown')
        if rc == 0:
            logger.info(f"MQTT client {protocol_id} connected successfully")
        else:
            logger.error(f"MQTT client {protocol_id} connection failed with code {rc}")
    
    def _on_disconnect(self, client, userdata, rc):
        """MQTT disconnect callback"""
        protocol_id = getattr(client, '_protocol_id', 'unknown')
        logger.info(f"MQTT client {protocol_id} disconnected with code {rc}")
    
    def _on_message(self, client, userdata, msg):
        """MQTT message received callback"""
        protocol_id = getattr(client, '_protocol_id', 'unknown')
        
        if protocol_id in self.active_connections:
            connection = self.active_connections[protocol_id]
            connection["received_messages"] += 1
            connection["last_activity"] = datetime.utcnow()
            
            # Store last message for topic
            if "last_messages" not in connection:
                connection["last_messages"] = {}
            
            connection["last_messages"][msg.topic] = {
                "payload": msg.payload.decode('utf-8', errors='ignore'),
                "qos": msg.qos,
                "retain": msg.retain,
                "timestamp": datetime.utcnow()
            }
    
    def _on_publish(self, client, userdata, mid):
        """MQTT publish callback"""
        protocol_id = getattr(client, '_protocol_id', 'unknown')
        if protocol_id in self.active_connections:
            self.active_connections[protocol_id]["published_messages"] += 1
    
    def _on_subscribe(self, client, userdata, mid, granted_qos):
        """MQTT subscribe callback"""
        protocol_id = getattr(client, '_protocol_id', 'unknown')
        logger.info(f"MQTT client {protocol_id} subscription confirmed with QoS {granted_qos}")
    
    async def read_data_point(self, connection_id: str, data_point_config: Dict[str, Any]) -> Any:
        """Read MQTT topic value (from last received message)"""
        try:
            if connection_id not in self.active_connections:
                raise Exception("Client not connected")
            
            connection = self.active_connections[connection_id]
            topic = data_point_config.get("topic", "sensors/temperature")
            
            last_messages = connection.get("last_messages", {})
            
            if topic not in last_messages:
                # If no message received yet, return None
                return {
                    "value": None,
                    "topic": topic,
                    "status": "No message received",
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            msg_data = last_messages[topic]
            payload = msg_data["payload"]
            
            # Try to parse JSON payload
            try:
                value = json.loads(payload)
            except (json.JSONDecodeError, ValueError):
                # If not JSON, return as string
                value = payload
            
            return {
                "value": value,
                "topic": topic,
                "qos": msg_data["qos"],
                "retain": msg_data["retain"],
                "timestamp": msg_data["timestamp"].isoformat(),
                "status": "Success"
            }
            
        except Exception as e:
            raise Exception(f"MQTT read error: {str(e)}")
    
    async def write_data_point(self, connection_id: str, data_point_config: Dict[str, Any], value: Any) -> bool:
        """Write MQTT topic value (publish message)"""
        try:
            if connection_id not in self.clients:
                raise Exception("Client not connected")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            topic = data_point_config.get("topic", "actuators/valve")
            qos = data_point_config.get("qos", 1)
            retain = data_point_config.get("retain", False)
            
            # Prepare payload
            if isinstance(value, (dict, list)):
                payload = json.dumps(value)
            else:
                payload = str(value)
            
            # Publish message
            result = await asyncio.to_thread(
                client.publish, topic, payload, qos, retain
            )
            
            if result.rc != mqtt.MQTT_ERR_SUCCESS:
                raise Exception(f"Publish failed with code {result.rc}")
            
            # Update statistics
            connection["last_activity"] = datetime.utcnow()
            
            await self._log_protocol_event(
                connection_id, "info",
                f"MQTT publish: Topic '{topic}' = {payload}",
                {"topic": topic, "qos": qos, "retain": retain, "payload_length": len(payload)}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"MQTT publish error: {str(e)}"
            )
            return False
    
    async def subscribe_topic(self, connection_id: str, topic: str, qos: int = 1) -> bool:
        """Subscribe to MQTT topic"""
        try:
            if connection_id not in self.clients:
                raise Exception("Client not connected")
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            result = await asyncio.to_thread(client.subscribe, topic, qos)
            
            if result[0] != mqtt.MQTT_ERR_SUCCESS:
                raise Exception(f"Subscribe failed with code {result[0]}")
            
            # Store subscription info
            connection["subscribed_topics"][topic] = {
                "qos": qos,
                "subscribed_at": datetime.utcnow(),
                "messages_received": 0
            }
            
            await self._log_protocol_event(
                connection_id, "info",
                f"MQTT subscribed to topic: {topic} (QoS {qos})",
                {"topic": topic, "qos": qos}
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"MQTT subscription error: {str(e)}"
            )
            return False
    
    async def unsubscribe_topic(self, connection_id: str, topic: str) -> bool:
        """Unsubscribe from MQTT topic"""
        try:
            if connection_id not in self.clients:
                return False
            
            client = self.clients[connection_id]
            connection = self.active_connections[connection_id]
            
            result = await asyncio.to_thread(client.unsubscribe, topic)
            
            if result[0] != mqtt.MQTT_ERR_SUCCESS:
                raise Exception(f"Unsubscribe failed with code {result[0]}")
            
            # Remove subscription info
            if topic in connection["subscribed_topics"]:
                del connection["subscribed_topics"][topic]
            
            await self._log_protocol_event(
                connection_id, "info",
                f"MQTT unsubscribed from topic: {topic}"
            )
            
            return True
            
        except Exception as e:
            await self._log_protocol_event(
                connection_id, "error",
                f"MQTT unsubscription error: {str(e)}"
            )
            return False
