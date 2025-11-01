# 🔧 Quick Fix Guide - Industrial IoT App

## 🚨 **MAIN ISSUE RESOLVED: CORS Error**

The main problem from your console logs was **CORS (Cross-Origin Resource Sharing)** error:
```
Zablokowano żądanie do zasobu innego pochodzenia: zasady „Same Origin Policy" nie pozwalają wczytywać zdalnych zasobów z "http://localhost:3001/..."
```

### ✅ **What I Fixed:**

#### 1. **Backend CORS Configuration** (`backend/main.py`):
```python
# ✅ FIXED - Added explicit CORS origins including localhost:80
CORS_ORIGINS = [
    "http://localhost:3000",   # React dev server
    "http://localhost:5173",   # Vite dev server
    "http://localhost:80",     # Docker frontend ← THIS WAS MISSING!
    "http://localhost",        # Docker frontend alternative
    "http://frontend:80",      # Docker internal network
    # ... more origins
]
```

#### 2. **API Import Errors** (`api is not defined`):
- ✅ Fixed `SettingsPage.tsx` - incorrect import `apiClient` → `api`
- ✅ Fixed `AddProtocolDialog.tsx` - ensured proper API usage
- ✅ All components now use consistent `import { api } from '@/services/api'`

#### 3. **Missing Components**:
- ✅ Added `Toast` notification system
- ✅ Added `Progress` bars for system metrics
- ✅ Added `LocationManager` for hierarchical management
- ✅ Enhanced `Header` with system status
- ✅ Created `AppLayout` with proper structure

---

## 🚀 **Quick Start Instructions:**

### **Option 1: Development Mode (Recommended for testing)**

#### Backend:
```bash
cd backend
pip install -r requirements.txt

# Create .env file with CORS configuration
cp .env.example .env

# Run development server with explicit CORS
python run_dev.py
```

#### Frontend:
```bash
cd frontend
npm install  # Install new dependencies (toast, etc.)
npm run dev  # This should now connect to backend without CORS errors!
```

### **Option 2: Docker Mode**
```bash
# Build and run everything
docker compose up --build

# Or build individually
docker compose up backend --build  # Backend first
docker compose up frontend --build  # Then frontend
```

---

## 🔍 **Verification Steps:**

### 1. **Backend Health Check**
Open: `http://localhost:3001/health`

Should return:
```json
{
  "status": "healthy",
  "message": "Industrial Protocols Management API is running",
  "services": {
    "database": "connected",
    "protocol_manager": "running",
    "websocket_manager": "running"
  }
}
```

### 2. **API Endpoints Test**
Open: `http://localhost:3001/docs` (Swagger UI)

Test these endpoints:
- `GET /api/status` - Should return API status
- `GET /api/locations/tree` - Should return location hierarchy
- `GET /api/protocols` - Should return protocols list

### 3. **Frontend Access**
Open: `http://localhost` (Docker) or `http://localhost:5173` (Dev)

**Should see:**
- ✅ No CORS errors in console
- ✅ System dashboard loads with real data
- ✅ Left sidebar shows location hierarchy
- ✅ Toast notifications work
- ✅ All navigation works

---

## ❌ **If Still Getting CORS Errors:**

### **Quick Debug Steps:**

1. **Check Backend Logs:**
```bash
# Look for CORS origins in startup logs
cd backend && python run_dev.py

# You should see:
# 🌐 CORS origins configured: ['http://localhost:80', ...]
```

2. **Test Backend Directly:**
```bash
curl -H "Origin: http://localhost:80" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3001/api/status
```

3. **Check Frontend Environment:**
```bash
# In frontend console, check:
console.log(import.meta.env.VITE_API_URL);  // Should be http://localhost:3001
```

### **Manual CORS Fix (if needed):**
Temporarily set CORS to allow all origins:

```python
# In backend/main.py, replace CORS configuration with:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ ONLY FOR DEVELOPMENT!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🎯 **Key Fixes Summary:**

| Issue | Status | Fix |
|-------|--------|-----|
| CORS Error | ✅ Fixed | Added `http://localhost:80` to CORS origins |
| `api is not defined` | ✅ Fixed | Corrected imports in SettingsPage.tsx |
| Missing Toast system | ✅ Added | Complete toast notification system |
| Missing Progress bars | ✅ Added | Progress component for metrics |
| Incomplete Sidebar | ✅ Enhanced | Full hierarchical tree with CRUD |
| Location Management | ✅ Added | Complete location API and UI |
| Docker URLs | ✅ Fixed | Corrected API and WebSocket URLs |
| Missing dependencies | ✅ Added | radix-ui/react-toast, class-variance-authority |

---

## 📋 **Next Steps (Co Dalej Do Zrobienia):**

After the CORS fix, you can now work on:

1. **🔌 Real Protocol Integration**
   - Test actual Modbus/OPC-UA connections
   - Add device discovery functionality
   - Implement data point auto-mapping

2. **📊 Enhanced Monitoring**
   - Real-time charts with historical data
   - Custom dashboard builder
   - Alert rule configuration

3. **🏗️ Advanced Location Features**
   - Assign devices to specific areas/zones
   - Location-based access control
   - Hierarchical alert propagation

4. **🔐 Security & Authentication**
   - User login system
   - Role-based permissions
   - Secure protocol credentials

5. **📱 Mobile Optimization**
   - Responsive design improvements
   - Touch-friendly controls
   - Offline data caching

---

## 🆘 **Emergency Debugging:**

If something is still broken:

1. **Reset Environment:**
```bash
# Stop all containers
docker compose down -v

# Rebuild everything
docker compose up --build --force-recreate
```

2. **Check Network:**
```bash
# Test if backend is responding
curl http://localhost:3001/health

# Test if frontend can reach backend
# (Run this from browser console while on localhost:80)
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

3. **Check Processes:**
```bash
# Check what's running on ports
netstat -tlnp | grep :3001  # Backend
netstat -tlnp | grep :80    # Frontend
netstat -tlnp | grep :27017 # MongoDB
```

**🎉 The main CORS issue should now be resolved!** Your frontend should connect to the backend without errors.