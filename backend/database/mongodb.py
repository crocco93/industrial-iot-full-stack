import os
import logging
from typing import Optional
from urllib.parse import urlparse
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

# Import all document models
from models.protocol import Protocol
from models.connection import Connection
from models.monitoring import MonitoringData
from models.system_log import SystemLog
from models.certificate import Certificate
from models.system_settings import SystemSettings
from models.device import Device
from models.data_point import DataPoint
from models.historical_data import HistoricalData
from models.location import Location
from models.alert import Alert

load_dotenv()

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database = None
        self.connection_string: Optional[str] = None
        self.database_name: Optional[str] = None

db = Database()

async def get_database():
    """Get database instance"""
    if db.database is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return db.database

def parse_mongo_url(mongo_url: str) -> tuple[str, str]:
    """Parse MongoDB URL to extract connection string and database name"""
    try:
        # Parse the URL
        parsed = urlparse(mongo_url)
        
        # Extract database name from path
        if parsed.path and len(parsed.path) > 1:
            database_name = parsed.path.lstrip('/')
            # Remove database name from connection string for client
            connection_string = mongo_url.rsplit('/', 1)[0] if '/' in parsed.path else mongo_url
        else:
            database_name = "protocols_db"  # Default database name
            connection_string = mongo_url
        
        return connection_string, database_name
    
    except Exception as e:
        logger.error(f"Failed to parse MongoDB URL: {e}")
        # Return safe defaults
        return "mongodb://localhost:27017", "protocols_db"

async def test_connection(client: AsyncIOMotorClient, database_name: str) -> bool:
    """Test MongoDB connection"""
    try:
        # Test connection with a simple ping
        await client.admin.command('ping')
        
        # Test database access
        database = client[database_name]
        await database.list_collection_names()
        
        logger.info(f"Successfully connected to MongoDB database: {database_name}")
        return True
    
    except Exception as e:
        logger.error(f"MongoDB connection test failed: {e}")
        return False

async def init_database():
    """Initialize database connection and Beanie ODM"""
    try:
        # Get MongoDB configuration
        mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/industrial_iot")
        
        # Parse URL
        connection_string, database_name = parse_mongo_url(mongo_url)
        
        logger.info(f"Connecting to MongoDB: {connection_string}/{database_name}")
        
        # Create MongoDB client with proper configuration
        db.client = AsyncIOMotorClient(
            connection_string,
            maxPoolSize=50,  # Maximum number of connections in the pool
            minPoolSize=5,   # Minimum number of connections in the pool
            maxIdleTimeMS=30000,  # Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS=5000,  # 5 second timeout for server selection
            connectTimeoutMS=10000,  # 10 second timeout for connection
            socketTimeoutMS=20000,   # 20 second timeout for socket operations
            retryWrites=True,        # Enable retryable writes
            retryReads=True,         # Enable retryable reads
        )
        
        # Store connection info
        db.connection_string = connection_string
        db.database_name = database_name
        
        # Test the connection
        connection_successful = await test_connection(db.client, database_name)
        
        if not connection_successful:
            raise RuntimeError("Failed to establish MongoDB connection")
        
        # Get database instance
        db.database = db.client[database_name]
        
        # Initialize Beanie with all document models
        document_models = [
            Protocol,
            Connection,
            MonitoringData,
            SystemLog,
            Certificate,
            SystemSettings,
            Device,
            DataPoint,
            HistoricalData,
            Location,  # ✅ DODANE
            Alert      # ✅ DODANE
        ]
        
        await init_beanie(
            database=db.database,
            document_models=document_models
        )
        
        logger.info(f"✅ Successfully initialized database with {len(document_models)} models")
        print(f"✅ Connected to MongoDB: {connection_string}/{database_name}")
        
        # Create indexes for better performance
        await create_indexes()
        
        return db.database
    
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        if db.client:
            await close_database()
        raise RuntimeError(f"Failed to initialize database: {str(e)}")

async def create_indexes():
    """Create database indexes for better query performance"""
    try:
        # Create indexes for MonitoringData
        await db.database.monitoring_data.create_index([("protocol_id", 1), ("timestamp", -1)])
        await db.database.monitoring_data.create_index([("timestamp", -1)])
        
        # Create indexes for SystemLog
        await db.database.system_log.create_index([("level", 1), ("timestamp", -1)])
        await db.database.system_log.create_index([("source", 1), ("timestamp", -1)])
        
        # Create indexes for DataPoint
        await db.database.data_point.create_index([("device_id", 1), ("tag", 1)])
        await db.database.data_point.create_index([("timestamp", -1)])
        
        # Create indexes for HistoricalData
        await db.database.historical_data.create_index([("device_id", 1), ("timestamp", -1)])
        await db.database.historical_data.create_index([("data_point_id", 1), ("timestamp", -1)])
        
        # Create indexes for Connection
        await db.database.connection.create_index([("protocol_id", 1)])
        await db.database.connection.create_index([("status", 1)])
        
        # Create indexes for Device
        await db.database.device.create_index([("protocol_id", 1)])
        await db.database.device.create_index([("location_id", 1)])
        
        # Create indexes for Location (NEW)
        await db.database.locations.create_index([("parent_id", 1), ("order_index", 1)])
        await db.database.locations.create_index([("type", 1), ("status", 1)])
        await db.database.locations.create_index([("path", 1)])
        
        # Create indexes for Alert (NEW)
        await db.database.alerts.create_index([("status", 1), ("severity", 1)])
        await db.database.alerts.create_index([("created_at", -1)])
        await db.database.alerts.create_index([("device_id", 1)])
        await db.database.alerts.create_index([("location_id", 1)])
        
        # Create indexes for Certificate (fingerprint should be unique)
        await db.database.certificate.create_index([("fingerprint", 1)], unique=True)
        
        logger.info("✅ Database indexes created successfully")
        
    except Exception as e:
        logger.warning(f"Failed to create some indexes: {e}")
        # Don't fail initialization if index creation fails

async def close_database():
    """Close database connection"""
    try:
        if db.client:
            # Properly close the client connection
            db.client.close()
            # Wait for the client to close
            await db.client.aclose() if hasattr(db.client, 'aclose') else None
            
            db.client = None
            db.database = None
            
            logger.info("✅ MongoDB connection closed successfully")
            print("✅ Disconnected from MongoDB")
    
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")
        print(f"❌ Error disconnecting from MongoDB: {e}")

async def get_connection_stats() -> dict:
    """Get MongoDB connection statistics"""
    try:
        if not db.client or not db.database:
            return {"status": "disconnected"}
        
        # Get server info
        server_info = await db.client.admin.command("serverStatus")
        
        # Get database stats
        db_stats = await db.database.command("dbStats")
        
        return {
            "status": "connected",
            "connection_string": db.connection_string,
            "database_name": db.database_name,
            "server_version": server_info.get("version", "unknown"),
            "collections": db_stats.get("collections", 0),
            "objects": db_stats.get("objects", 0),
            "data_size": db_stats.get("dataSize", 0),
            "storage_size": db_stats.get("storageSize", 0)
        }
    
    except Exception as e:
        logger.error(f"Failed to get connection stats: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

async def health_check() -> dict:
    """Perform database health check"""
    try:
        if not db.client or not db.database:
            return {"healthy": False, "error": "Database not initialized"}
        
        # Test connection with ping
        await db.client.admin.command('ping')
        
        # Test database operations
        collections = await db.database.list_collection_names()
        
        return {
            "healthy": True,
            "database_name": db.database_name,
            "collections_count": len(collections),
            "collections": collections
        }
    
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "healthy": False,
            "error": str(e)
        }