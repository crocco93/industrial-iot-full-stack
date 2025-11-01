import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: string;
  permissions: Record<string, boolean>;
  last_login?: string;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initialize authentication on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const savedToken = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('user_info');
      
      if (savedToken && savedUser) {
        // Set API header
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        
        try {
          // Verify token is still valid
          const response = await api.post('/api/auth/verify-token');
          
          if (response.data?.valid) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            console.log('Auth: Token verified, user restored');
          } else {
            // Token invalid, clear storage
            clearAuthData();
          }
          
        } catch (error) {
          console.log('Auth: Token verification failed, clearing auth data');
          clearAuthData();
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });
      
      if (response.data?.access_token) {
        const { access_token, user: userData } = response.data;
        
        // Store authentication data
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('user_info', JSON.stringify(userData));
        
        // Set API header
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        setToken(access_token);
        setUser(userData);
        
        console.log(`Auth: User ${userData.username} logged in with role ${userData.role}`);
        
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      const errorMessage = error.response?.data?.detail || 'Login failed';
      toast({
        title: "Błąd logowania",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    }
  };

  const logout = () => {
    try {
      // Call logout endpoint (optional)
      api.post('/api/auth/logout').catch((error) => {
        console.warn('Logout endpoint error (non-critical):', error);
      });
      
    } finally {
      // Clear auth data regardless of API call result
      clearAuthData();
      
      toast({
        title: "Wylogowano",
        description: "Zostałeś pomyślnie wylogowany z systemu",
        variant: "default"
      });
      
      console.log('Auth: User logged out');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admins have all permissions
    return user.permissions?.[permission] === true;
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin' || hasPermission('admin_access');
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      if (!token) return false;
      
      const response = await api.post('/api/auth/verify-token');
      
      if (response.data?.valid) {
        // Update user info if provided
        if (response.data.user) {
          setUser(response.data.user);
          localStorage.setItem('user_info', JSON.stringify(response.data.user));
        }
        return true;
      } else {
        clearAuthData();
        return false;
      }
      
    } catch (error) {
      console.error('Token refresh error:', error);
      clearAuthData();
      return false;
    }
  };

  // Auto-refresh token periodically
  useEffect(() => {
    if (!token) return;
    
    const refreshInterval = setInterval(() => {
      refreshToken().catch((error) => {
        console.error('Periodic token refresh failed:', error);
      });
    }, 10 * 60 * 1000); // Every 10 minutes
    
    return () => clearInterval(refreshInterval);
  }, [token]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    hasPermission,
    isAdmin,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Higher-order component for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  adminOnly?: boolean;
  fallback?: ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredPermission, 
  adminOnly = false,
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, isAdmin, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return fallback || <div>Authentication required</div>;
  }
  
  if (adminOnly && !isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Brak dostępu</h2>
          <p className="text-gray-600">Wymagane uprawnienia administratora</p>
        </div>
      </div>
    );
  }
  
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Brak uprawnień</h2>
          <p className="text-gray-600">Nie posiadasz uprawnienia: {requiredPermission}</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}