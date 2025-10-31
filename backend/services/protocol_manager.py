import asyncio
import logging
from typing import Dict, Any
from datetime import datetime
from models.protocol import Protocol, ProtocolStatus, ProtocolType
from .protocol_services import get_protocol_service

logger = logging.getLogger(__name__)

class ProtocolManager:
    """Manager for all protocol services and connections"""
    
    def __init__(self):
        self.running_protocols: Dict[str, Dict] = {}
    
    async def start_protocol(self, protocol_id: str, protocol_type: str, configuration: Dict[str, Any]) -> bool:
        """Start a specific protocol"""
        try:
            # Convert string to ProtocolType if needed
            if isinstance(protocol_type, str):
                try:
                    protocol_type = ProtocolType(protocol_type)
                except ValueError:
                    logger.error(f"Invalid protocol type: {protocol_type}")
                    return False
            
            service = get_protocol_service(protocol_type)
            if not service:
                raise Exception(f"No service available for protocol type: {protocol_type}")
            
            # Start the protocol service
            success = await service.start_protocol(protocol_id, configuration)
            
            if success:
                self.running_protocols[protocol_id] = {
                    "protocol_type": protocol_type.value if hasattr(protocol_type, 'value') else str(protocol_type),
                    "service": service,
                    "configuration": configuration,
                    "started_at": datetime.utcnow(),  # Changed from datetime.now()
                    "status": "running"
                }
                
                # Update protocol status in database
                protocol = await Protocol.get(protocol_id)
                if protocol:
                    protocol.status = ProtocolStatus.CONNECTED
                    protocol.updated_at = datetime.utcnow()
                    await protocol.save()
                
                logger.info(f"Successfully started protocol {protocol_id} of type {protocol_type}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error starting protocol {protocol_id}: {e}")
            # Update protocol status to error in database
            try:
                protocol = await Protocol.get(protocol_id)
                if protocol:
                    protocol.status = ProtocolStatus.ERROR
                    protocol.updated_at = datetime.utcnow()
                    await protocol.save()
            except Exception as db_error:
                logger.error(f"Error updating protocol status in database: {db_error}")
            
            return False
    
    async def stop_protocol(self, protocol_id: str) -> bool:
        """Stop a specific protocol"""
        try:
            if protocol_id not in self.running_protocols:
                logger.warning(f"Protocol {protocol_id} is not running")
                return True  # Already stopped
            
            protocol_info = self.running_protocols[protocol_id]
            service = protocol_info["service"]
            
            # Stop the protocol service
            success = await service.stop_protocol(protocol_id)
            
            if success:
                del self.running_protocols[protocol_id]
                
                # Update protocol status in database
                protocol = await Protocol.get(protocol_id)
                if protocol:
                    protocol.status = ProtocolStatus.DISCONNECTED
                    protocol.updated_at = datetime.utcnow()
                    await protocol.save()
                
                logger.info(f"Successfully stopped protocol {protocol_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error stopping protocol {protocol_id}: {e}")
            return False
    
    async def restart_protocol(self, protocol_id: str) -> bool:
        """Restart a specific protocol"""
        try:
            if protocol_id in self.running_protocols:
                protocol_info = self.running_protocols[protocol_id]
                protocol_type = protocol_info["protocol_type"]
                configuration = protocol_info["configuration"]
                
                logger.info(f"Restarting protocol {protocol_id}")
                
                # Stop first
                await self.stop_protocol(protocol_id)
                
                # Wait a moment
                await asyncio.sleep(2)
                
                # Start again
                return await self.start_protocol(protocol_id, protocol_type, configuration)
            
            logger.warning(f"Cannot restart protocol {protocol_id} - not running")
            return False
            
        except Exception as e:
            logger.error(f"Error restarting protocol {protocol_id}: {e}")
            return False
    
    async def start_all_protocols(self) -> bool:
        """Start all protocols from database that should be running"""
        try:
            protocols = await Protocol.find_all().to_list()
            started_count = 0
            
            for protocol in protocols:
                # Only start protocols that were previously connected
                if protocol.status == ProtocolStatus.CONNECTED:
                    success = await self.start_protocol(
                        str(protocol.id),
                        protocol.type,  # Pass ProtocolType enum directly
                        protocol.configuration
                    )
                    if success:
                        started_count += 1
            
            logger.info(f"Started {started_count} protocols from database")
            return True
            
        except Exception as e:
            logger.error(f"Error starting all protocols: {e}")
            return False
    
    async def stop_all_protocols(self) -> bool:
        """Stop all running protocols"""
        try:
            protocol_ids = list(self.running_protocols.keys())
            stopped_count = 0
            
            for protocol_id in protocol_ids:
                success = await self.stop_protocol(protocol_id)
                if success:
                    stopped_count += 1
            
            logger.info(f"Stopped {stopped_count} protocols")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping all protocols: {e}")
            return False
    
    def get_protocol_status(self, protocol_id: str) -> Dict[str, Any]:
        """Get status of a specific protocol"""
        if protocol_id not in self.running_protocols:
            return {
                "status": "stopped", 
                "message": "Protocol not running",
                "protocol_id": protocol_id
            }
        
        protocol_info = self.running_protocols[protocol_id]
        service = protocol_info["service"]
        
        return {
            "status": "running",
            "protocol_id": protocol_id,
            "protocol_type": protocol_info["protocol_type"],
            "started_at": protocol_info["started_at"].isoformat(),
            "active_connections": len(service.active_connections),
            "is_monitoring": service.is_running,
            "configuration": protocol_info["configuration"],
            "uptime_seconds": (datetime.utcnow() - protocol_info["started_at"]).total_seconds()
        }
    
    def get_all_protocol_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all protocols"""
        status = {}
        for protocol_id in self.running_protocols:
            status[protocol_id] = self.get_protocol_status(protocol_id)
        return status
    
    async def test_protocol_connection(self, protocol_type: str, address: str, configuration: Dict[str, Any]) -> bool:
        """Test a protocol connection without starting it"""
        try:
            # Convert string to ProtocolType if needed
            if isinstance(protocol_type, str):
                try:
                    protocol_type = ProtocolType(protocol_type)
                except ValueError:
                    logger.error(f"Invalid protocol type: {protocol_type}")
                    return False
            
            service = get_protocol_service(protocol_type)
            if not service:
                logger.error(f"No service available for protocol type: {protocol_type}")
                return False
            
            # Test with timeout
            result = await asyncio.wait_for(
                service.test_connection(address, configuration),
                timeout=30.0  # 30 second timeout
            )
            
            logger.info(f"Protocol connection test for {protocol_type} to {address}: {'SUCCESS' if result else 'FAILED'}")
            return result
            
        except asyncio.TimeoutError:
            logger.error(f"Protocol connection test timeout for {protocol_type} to {address}")
            return False
        except Exception as e:
            logger.error(f"Error testing protocol connection: {e}")
            return False
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get protocol manager statistics"""
        return {
            "total_running_protocols": len(self.running_protocols),
            "protocol_types": list(set(info["protocol_type"] for info in self.running_protocols.values())),
            "total_connections": sum(
                len(info["service"].active_connections) 
                for info in self.running_protocols.values()
            ),
            "uptime": {
                protocol_id: (datetime.utcnow() - info["started_at"]).total_seconds()
                for protocol_id, info in self.running_protocols.items()
            }
        }

# Global protocol manager instance
protocol_manager = ProtocolManager()
