import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Settings,
  User,
  LogOut,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Search,
  Menu,
  Home
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
  className?: string;
}

interface SystemStatus {
  status: string;
  active_protocols: number;
  websocket_connections: number;
  alert_count: number;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  
  useEffect(() => {
    loadSystemStatus();
    loadNotifications();
    
    // Refresh status every 30 seconds
    const interval = setInterval(() => {
      loadSystemStatus();
      loadNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const loadSystemStatus = async () => {
    try {
      const response = await api.get('/api/status');
      const data = response.data;
      
      setSystemStatus({
        status: data.status || 'unknown',
        active_protocols: data.protocol_manager?.running_protocols || 0,
        websocket_connections: data.statistics?.websocket_connections || 0,
        alert_count: 0 // Will be populated by alerts API
      });
      
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('[Header] Failed to load system status:', error);
      setConnectionStatus('error');
    }
  };
  
  const loadNotifications = async () => {
    try {
      // This would load actual notifications/alerts
      // For now, showing sample notifications
      setNotifications([
        {
          id: '1',
          title: 'Protocol Connected',
          description: 'Modbus TCP protocol successfully connected',
          severity: 'info',
          timestamp: new Date().toISOString(),
          read: false
        }
      ]);
    } catch (error) {
      console.error('[Header] Failed to load notifications:', error);
    }
  };
  
  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case '/':
      case '/dashboard':
        return 'System Overview';
      case '/protocols':
        return 'Protocol Management';
      case '/devices':
        return 'Device Management';
      case '/monitoring':
        return 'Real-time Monitoring';
      case '/historical':
        return 'Historical Data';
      case '/alerts':
        return 'Alert Management';
      case '/settings':
        return 'System Settings';
      default:
        return 'Industrial IoT Platform';
    }
  };
  
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-yellow-600 animate-pulse" />;
    }
  };
  
  const unreadNotifications = notifications.filter(n => !n.read).length;
  
  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 px-6 py-4 ${className || ''}`}>
      <div className="flex justify-between items-center">
        {/* Left Side - Title and Breadcrumbs */}
        <div className="flex items-center space-x-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/')}
            className="p-2"
          >
            <Home className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
            <div className="text-sm text-gray-500 mt-0.5">
              {location.pathname !== '/' && (
                <span className="flex items-center space-x-1">
                  <span>Dashboard</span>
                  <span>›</span>
                  <span className="font-medium">{getPageTitle()}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Side - Status and Actions */}
        <div className="flex items-center space-x-4">
          {/* System Status */}
          {systemStatus && (
            <div className="hidden md:flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-1">
                {getConnectionIcon()}
                <span className="text-gray-600">
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'error' ? 'Disconnected' : 'Connecting...'}
                </span>
              </div>
              
              {connectionStatus === 'connected' && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{systemStatus.active_protocols} protocols</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span>{systemStatus.websocket_connections} connections</span>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="relative p-2">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 bg-red-500"
                  >
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadNotifications > 0 && (
                  <p className="text-sm text-gray-600">{unreadNotifications} unread</p>
                )}
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b hover:bg-gray-50 ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{notification.title}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {notification.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        
                        <div className="ml-2">
                          {notification.severity === 'error' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {notification.severity === 'warning' && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          {notification.severity === 'info' && (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/alerts')}
                  >
                    View All Alerts
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          {/* User Menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="p-2">
                <User className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="space-y-1">
                <div className="px-2 py-1.5 text-sm font-medium">Admin User</div>
                <div className="px-2 py-1 text-xs text-gray-500">admin@industrial-iot.com</div>
                
                <Separator className="my-2" />
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-800"
                  onClick={() => {
                    toast({
                      title: "Logged Out",
                      description: "You have been successfully logged out"
                    });
                    // In a real app, would handle logout
                    console.log('[Header] Logout clicked');
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Mobile Menu Toggle */}
          <Button size="sm" variant="ghost" className="md:hidden p-2">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Mobile Status Bar */}
      {systemStatus && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <span className="text-gray-600">
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {connectionStatus === 'connected' && (
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>{systemStatus.active_protocols} protocols</span>
                <span>{systemStatus.websocket_connections} connections</span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};