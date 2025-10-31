# models/__init__.py
from enum import Enum

# Import enums first
from .data_point import DataType

# Then import Document classes
from .protocol import Protocol
from .connection import Connection  
from .monitoring import MonitoringData
from .system_log import SystemLog
from .certificate import Certificate
from .system_settings import SystemSettings
from .device import Device
from .data_point import DataPoint
from .historical_data import HistoricalData

__all__ = [
    'Protocol',
    'Connection', 
    'MonitoringData',
    'SystemLog',
    'Certificate',
    'SystemSettings',
    'Device',
    'DataPoint',
    'DataType',
    'HistoricalData'
]
