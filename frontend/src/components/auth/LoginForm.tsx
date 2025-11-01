import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Lock, User, Eye, EyeOff, LogIn, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

interface LoginFormProps {
  onLoginSuccess: (token: string, user: any) => void;
  onError?: (error: string) => void;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email?: string;
    full_name?: string;
    role: string;
    permissions: Record<string, boolean>;
    last_login?: string;
  };
}

export function LoginForm({ onLoginSuccess, onError }: LoginFormProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setError('Nazwa użytkownika i hasło są wymagane');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.post<LoginResponse>('/api/auth/login', {
        username: username.trim(),
        password: password
      });
      
      if (response.data?.access_token) {
        // Store token in localStorage
        localStorage.setItem('auth_token', response.data.access_token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
        
        // Set API authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
        
        toast({
          title: "Zalogowano pomyślnie",
          description: `Witaj, ${response.data.user.full_name || response.data.user.username}! Rola: ${response.data.user.role}`,
          variant: "default"
        });
        
        onLoginSuccess(response.data.access_token, response.data.user);
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.message || 
                           'Login failed';
      
      setError(errorMessage);
      onError?.(errorMessage);
      
      toast({
        title: "Błąd logowania",
        description: errorMessage,
        variant: "destructive"
      });
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDemoLogin = () => {
    setUsername('admin');
    setPassword('admin');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-blue-600 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Industrial IoT System</h1>
          <p className="text-gray-600">Logowanie do systemu zarządzania</p>
        </div>
        
        {/* Demo Credentials Info */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>Konto testowe: <strong>admin / admin</strong></span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDemoLogin}
                className="text-xs"
              >
                Użyj demo
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        
        {/* Login Form */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center">
              <LogIn className="h-5 w-5 mr-2" />
              Logowanie
            </CardTitle>
            <CardDescription>
              Wprowadź dane logowania aby uzyskać dostęp do systemu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username">Nazwa użytkownika</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Wprowadź nazwę użytkownika"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>
              
              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Wprowadź hasło"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !username.trim() || !password.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Logowanie...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Zaloguj się
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* System Info */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium text-sm text-gray-700">Informacje o systemie</h3>
              <div className="flex justify-center space-x-2">
                <Badge variant="secondary">Industrial IoT v1.0</Badge>
                <Badge variant="outline">JWT Auth</Badge>
                <Badge variant="outline">Multi-Protocol</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                System zarządzania protokołami przemysłowymi<br />
                Modbus TCP • OPC-UA • MQTT • Profinet • EtherNet/IP
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>&copy; 2024 Industrial IoT Management System</p>
          <p className="mt-1">Secure access to industrial automation data</p>
        </div>
      </div>
    </div>
  );
}