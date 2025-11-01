import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Home,
  Shield
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  className?: string;
  onToggleSidebar?: () => void;
}

interface SystemStatus {
  status: string;
  active_protocols: number;
  websocket_connections: number;
  registered_users: number;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  source: string;
}

export const Header: React.FC<HeaderProps> = ({ className, onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, isAdmin, hasPermission, isAuthenticated } = useAuth();
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  
  useEffect(() => {
    if (isAuthenticated) {
      loadSystemStatus();
      loadAlerts();
      
      // Refresh status every 30 seconds
      const interval = setInterval(() => {
        loadSystemStatus();
        loadAlerts();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);
  
  const loadSystemStatus = async () => {
    try {
      const response = await api.get('/health');
      const data = response.data;
      
      setSystemStatus({
        status: data.status || 'unknown',
        active_protocols: data.statistics?.active_protocols || 0,
        websocket_connections: data.statistics?.websocket_connections || 0,
        registered_users: data.statistics?.registered_users || 0
      });
      
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('[Header] Failed to load system status:', error);
      setConnectionStatus('error');
    }
  };
  
  const loadAlerts = async () => {
    try {
      const response = await api.get('/api/alerts?limit=10&acknowledged=false');
      setAlerts(response.data || []);
    } catch (error) {
      console.error('[Header] Failed to load alerts:', error);
      setAlerts([]);
    }
  };
  
  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case '/':
      case '/dashboard':
        return 'Przegląd systemu';
      case '/protocols':
        return 'Zarządzanie protokołami';
      case '/devices':
        return 'Zarządzanie urządzeniami';
      case '/monitoring':
        return 'Monitoring czasu rzeczywistego';
      case '/historical':
        return 'Dane historyczne';
      case '/alerts':
        return 'Zarządzanie alertami';
      case '/locations':
        return 'Zarządzanie lokalizacjami';
      case '/settings':
        return 'Ustawienia systemu';
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
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'operator':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user?.username.substring(0, 2).toUpperCase() || 'U';
  };
  
  const unreadAlerts = alerts.filter(alert => !alert.acknowledged).length;
  
  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 px-4 lg:px-6 py-3 ${className || ''}`}>
      <div className="flex justify-between items-center">
        {/* Left Side - Navigation and Title */}
        <div className="flex items-center space-x-4">
          {/* Sidebar Toggle (Mobile) */}
          {onToggleSidebar && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleSidebar}
              className="lg:hidden p-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          {/* Home Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/')}
            className="p-2"
          >
            <Home className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Page Title */}
          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
            {location.pathname !== '/' && (
              <div className="text-xs text-gray-500 hidden sm:block">
                Dashboard › {getPageTitle()}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Side - Status and User Actions */}
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* System Status (Desktop) */}
          {systemStatus && (
            <div className="hidden lg:flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-1">
                {getConnectionIcon()}
                <span className="text-gray-600">
                  {connectionStatus === 'connected' ? 'Online' : 
                   connectionStatus === 'error' ? 'Offline' : 'Łączenie...'}
                </span>
              </div>
              
              {connectionStatus === 'connected' && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>{systemStatus.active_protocols}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span>{systemStatus.websocket_connections}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Alerts Notification */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="relative p-2">
                <Bell className="h-5 w-5" />
                {unreadAlerts > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 bg-red-500">
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Alerty systemowe</h3>
                {unreadAlerts > 0 && (
                  <p className="text-sm text-gray-600">{unreadAlerts} nowych alertów</p>
                )}
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Brak nowych alertów
                  </div>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                        !alert.acknowledged ? 'bg-yellow-50' : ''
                      }`}
                      onClick={() => navigate('/alerts')}
                    >
                      <div className="flex items-start space-x-2">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {alert.title}
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {alert.message}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {alert.source} • {new Date(alert.timestamp).toLocaleTimeString('pl-PL')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {alerts.length > 0 && (
                <div className="p-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/alerts')}
                  >
                    Zobacz wszystkie alerty
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-100 text-blue-800 text-sm font-medium">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none">
                      {user?.full_name || user?.username}
                    </p>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getRoleColor(user?.role || 'user')}`}
                    >
                      {user?.role === 'admin' ? 'Administrator' : 
                       user?.role === 'operator' ? 'Operator' : 
                       user?.role === 'viewer' ? 'Obserwator' : 'Użytkownik'}
                    </Badge>
                  </div>
                  {user?.email && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Ostatnie logowanie: {user?.last_login 
                      ? new Date(user.last_login).toLocaleString('pl-PL') 
                      : 'Teraz'
                    }
                  </p>
                </div>
              </DropdownMenuLabel>
              
              <DropdownMenuSeparator />
              
              {/* User Permissions Summary */}
              {user?.permissions && (
                <>
                  <div className="px-2 py-2">
                    <p className="text-xs text-muted-foreground mb-2">Uprawnienia:</p>
                    <div className="space-y-1">
                      {Object.entries(user.permissions).slice(0, 4).map(([permission, hasAccess]) => (
                        <div key={permission} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">
                            {permission.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${
                            hasAccess ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profil użytkownika</span>
              </DropdownMenuItem>
              
              {(isAdmin() || hasPermission('system_settings')) && (
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Ustawienia systemu</span>
                </DropdownMenuItem>
              )}
              
              {isAdmin() && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Panel administratora</span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Wyloguj się</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Mobile Status Bar */}
      {systemStatus && (
        <div className="lg:hidden mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <span className="text-gray-600">
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </span>
              {isAdmin() && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            
            {connectionStatus === 'connected' && (
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>{systemStatus.active_protocols} protokołów</span>
                <span>{systemStatus.websocket_connections} połączeń</span>
                {unreadAlerts > 0 && (
                  <span className="text-red-600">{unreadAlerts} alertów</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};