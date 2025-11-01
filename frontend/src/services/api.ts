import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create axios instance with proper configuration
const apiInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Request interceptor for auth tokens
apiInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data) {
      console.log(`[API] Request data:`, config.data);
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error);
    
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    if (error.response?.status === 404) {
      console.warn('[API] Endpoint not found:', error.config?.url);
    }
    
    if (error.response?.status >= 500) {
      console.error('[API] Server error:', error.response?.data);
    }
    
    return Promise.reject(error);
  }
);

// API object with methods that work properly
export const api = {
  // GET request
  get: async <T = any>(url: string, params?: Record<string, any>): Promise<AxiosResponse<T>> => {
    return apiInstance.get<T>(url, { params });
  },
  
  // POST request  
  post: async <T = any>(url: string, data?: any): Promise<AxiosResponse<T>> => {
    return apiInstance.post<T>(url, data);
  },
  
  // PUT request
  put: async <T = any>(url: string, data?: any): Promise<AxiosResponse<T>> => {
    return apiInstance.put<T>(url, data);
  },
  
  // PATCH request
  patch: async <T = any>(url: string, data?: any): Promise<AxiosResponse<T>> => {
    return apiInstance.patch<T>(url, data);
  },
  
  // DELETE request
  delete: async <T = any>(url: string): Promise<AxiosResponse<T>> => {
    return apiInstance.delete<T>(url);
  },
  
  // Raw axios instance for advanced usage
  axios: apiInstance,
  
  // Helper methods
  setAuthToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    apiInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  
  removeAuthToken: () => {
    localStorage.removeItem('auth_token');
    delete apiInstance.defaults.headers.common['Authorization'];
  },
  
  // Test connection
  testConnection: async (): Promise<boolean> => {
    try {
      const response = await apiInstance.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('[API] Connection test failed:', error);
      return false;
    }
  }
};

// Default export for backwards compatibility
export default api;

// Export types
export type { AxiosResponse, AxiosError } from 'axios';