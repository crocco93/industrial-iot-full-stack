# Industrial IoT Full-Stack Application 🏭

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/crocco93/industrial-iot-full-stack)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-blue)](https://python.org)
[![React](https://img.shields.io/badge/react-18+-blue)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/fastapi-0.104+-green)](https://fastapi.tiangolo.com)

Kompletny system zarządzania urządzeniami przemysłowymi IoT z obsługą wielu protokołów komunikacyjnych, analityką w czasie rzeczywistym, zaawansowanymi dashboardami i systemem alertów.

## ✨ Główne funkcje

### 🔌 Obsługa protokołów przemysłowych
- **Modbus TCP/RTU** - PLC i sensory przemysłowe
- **OPC-UA** - Systemy SCADA i automatyki
- **Profinet** - Urządzenia Siemens i automatyka
- **EtherNet/IP** - Rozwiązania Allen-Bradley/Rockwell
- **MQTT** - IoT i systemy rozproszone
- **CANopen** - Systemy embedded i automotive
- **BACnet** - Systemy budynkowe i HVAC

### 📊 Zaawansowana analityka
- **Dashboardy w czasie rzeczywistym** z konfigurowalnymi widgetami
- **Analiza historyczna** z agregacjami (raw/hourly/daily)
- **Eksport danych** do CSV/Excel dla dalszej analizy
- **Wskaźniki KPI** i metryki wydajności
- **Wykresy trendów** z multiple data points

### 🚨 Inteligentny system alertów
- **Alerty progowe** z konfigurowalnymi limitami
- **Zarządzanie alertami** (acknowledge/resolve/mute)
- **Operacje bulk** na wielu alertach jednocześnie
- **Integracje webhook** (Slack, Teams, email)
- **Filtrowanie i kategoryzacja** alertów
- **WebSocket real-time** powiadomienia

### 🏗️ Zarządzanie hierarchią
- **Struktura hierarchiczna** (Lokalizacja → Area → Urządzenie → Punkt danych)
- **Drag & Drop** reorganizacja w drzewku
- **Wyszukiwanie i filtrowanie** urządzeń
- **Zarządzanie połączeniami** i protokołami

### 🔧 Monitorowanie systemu
- **Health checks** wszystkich komponentów
- **Metryki systemowe** (CPU, RAM, Disk)
- **Status połączeń** i protokołów w czasie rzeczywistym
- **Logi systemowe** z różnymi poziomami szczegółowości

## 🏛️ Architektura systemu

### Backend (FastAPI)
```
backend/
├── api/                    # REST API endpoints
│   ├── protocols.py       # Zarządzanie protokołami
│   ├── devices.py         # CRUD urządzeń
│   ├── data_points.py     # Punkty danych i odczyty
│   ├── historical.py      # API danych historycznych
│   ├── alerts.py          # System alertów
│   ├── health.py          # Health checks
│   └── dashboards.py      # Zarządzanie dashboardami
├── models/                 # Modele danych (Beanie/MongoDB)
│   ├── device.py          # Model urządzenia
│   ├── protocol.py        # Model protokołu
│   ├── data_point.py      # Model punktu danych
│   ├── alert.py           # Model alertu
│   └── monitoring.py      # Dane monitorowania
├── services/              # Logika biznesowa
│   ├── protocol_services/ # Implementacje protokołów
│   ├── websocket_manager.py # WebSocket real-time
│   └── protocol_manager.py # Zarządzanie protokołami
└── database/              # Konfiguracja MongoDB
```

### Frontend (React + TypeScript)
```
frontend/src/
├── components/
│   ├── monitoring/        # Komponenty monitorowania
│   │   ├── SystemDashboard.tsx # Główny dashboard
│   │   ├── AlertPanel.tsx     # Panel alertów
│   │   └── ProtocolMetrics.tsx # Metryki protokołów
│   ├── devices/          # Zarządzanie urządzeniami
│   │   ├── DeviceManager.tsx  # Lista i zarządzanie
│   │   └── AddDeviceDialog.tsx # Dodawanie urządzeń
│   ├── protocols/        # Zarządzanie protokołami
│   ├── history/          # Analiza historyczna
│   ├── dashboard/        # Komponenty dashboardu
│   │   └── DashboardGrid.tsx  # Grid z drag&drop
│   ├── settings/         # Ustawienia systemowe
│   └── common/           # Wspólne komponenty
│       └── HierarchicalTree.tsx # Drzewko hierarchiczne
├── hooks/                # React hooks
│   ├── useWebSocket.ts   # WebSocket hook
│   └── use-toast.ts      # Toast notifications
└── services/
    └── api.ts            # HTTP client
```

## 🚀 Szybki start

### Wymagania systemowe
- **Python 3.9+**
- **Node.js 18+**
- **MongoDB 6.0+**
- **Redis 7.0+** (opcjonalnie)

### 1. Klonowanie repozytorium
```bash
git clone https://github.com/crocco93/industrial-iot-full-stack.git
cd industrial-iot-full-stack
```

### 2. Konfiguracja backendu
```bash
cd backend

# Tworzenie środowiska wirtualnego
python -m venv venv
source venv/bin/activate  # Linux/Mac
# lub
venv\\Scripts\\activate   # Windows

# Instalacja zależności
pip install -r requirements.txt

# Konfiguracja zmiennych środowiskowych
cp .env.example .env
# Edytuj .env z właściwymi wartościami
```

**Kluczowe zmienne środowiskowe:**
```bash
# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=industrial_iot

# Security
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# External services (opcjonalnie)
N8N_WEBHOOK_URL=http://localhost:5678/webhook
OLLAMA_API_URL=http://localhost:11434
```

### 3. Uruchomienie backendu
```bash
# Development mode
uvicorn main:app --host 0.0.0.0 --port 3001 --reload

# Production mode
uvicorn main:app --host 0.0.0.0 --port 3001
```

### 4. Konfiguracja frontendu
```bash
cd frontend

# Instalacja zależności
npm install

# Konfiguracja zmiennych
cp .env.example .env.local
# Edytuj .env.local
```

**Frontend environment (.env.local):**
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 5. Uruchomienie frontendu
```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

### 6. Dostęp do aplikacji
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **API Documentation:** http://localhost:3001/docs
- **Health Check:** http://localhost:3001/health

## 🐳 Docker deployment

### Docker Compose (najprostszy sposób)
```bash
# Uruchomienie całego stacku
docker-compose up -d

# Sprawdzenie statusu
docker-compose ps

# Logi
docker-compose logs -f
```

### Budowanie obrazów
```bash
# Backend
cd backend
docker build -t industrial-iot-backend .

# Frontend  
cd frontend
docker build -t industrial-iot-frontend .
```

## 📡 API Endpoints

### Główne kategorie API

#### 🔌 Protokoły
- `GET /api/protocols` - Lista protokołów
- `POST /api/protocols` - Dodaj nowy protokół
- `PUT /api/protocols/{id}` - Aktualizuj protokół
- `DELETE /api/protocols/{id}` - Usuń protokół
- `POST /api/protocols/{id}/start` - Uruchom protokół
- `POST /api/protocols/{id}/stop` - Zatrzymaj protokół

#### 🔧 Urządzenia
- `GET /api/devices` - Lista urządzeń
- `POST /api/devices` - Dodaj urządzenie
- `PUT /api/devices/{id}` - Aktualizuj urządzenie
- `DELETE /api/devices/{id}` - Usuń urządzenie
- `GET /api/devices/{id}/data-points` - Punkty danych urządzenia

#### 📊 Dane historyczne
- `GET /api/data-points/historical` - Dane historyczne
- `GET /api/data-points/{id}/stats` - Statystyki punktu danych
- `POST /api/data-points/{id}/historical` - Dodaj dane historyczne
- `DELETE /api/data-points/{id}/historical` - Wyczyść dane

#### 🚨 Alerty
- `GET /api/alerts` - Lista alertów z filtrowaniem
- `POST /api/alerts` - Utwórz alert
- `PUT /api/alerts/{id}/acknowledge` - Potwierdź alert
- `PUT /api/alerts/{id}/resolve` - Rozwiąż alert
- `PUT /api/alerts/{id}/mute` - Wycisz alert
- `POST /api/alerts/bulk-acknowledge` - Bulk acknowledge
- `GET /api/alerts/stats` - Statystyki alertów

#### 📈 Dashboardy
- `GET /api/dashboards` - Lista dashboardów
- `POST /api/dashboards` - Utwórz dashboard
- `PUT /api/dashboards/{id}` - Aktualizuj dashboard
- `DELETE /api/dashboards/{id}` - Usuń dashboard

#### 🏥 System Health
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Szczegółowy status
- `GET /api/status` - Status API

## 🔧 Konfiguracja protokołów

### Modbus TCP
```json
{
  "name": "PLC Modbus",
  "type": "modbus-tcp",
  "configuration": {
    "host": "192.168.1.100",
    "port": 502,
    "unit_id": 1,
    "timeout": 3.0,
    "read_coils": [1, 10],
    "read_holding_registers": [40001, 10]
  }
}
```

### OPC-UA
```json
{
  "name": "SCADA OPC-UA",
  "type": "opc-ua",
  "configuration": {
    "endpoint_url": "opc.tcp://192.168.1.101:4840",
    "security_mode": "None",
    "nodes_to_read": [
      "ns=2;i=2",
      "ns=2;s=Temperature"
    ]
  }
}
```

### MQTT
```json
{
  "name": "IoT MQTT Broker",
  "type": "mqtt",
  "configuration": {
    "broker_host": "192.168.1.102",
    "broker_port": 1883,
    "topics": [
      "sensors/temperature",
      "sensors/humidity"
    ],
    "qos": 1
  }
}
```

## ⚙️ Nowe funkcje (v1.0.0)

### 🔄 WebSocket Real-time Updates
System wykorzystuje WebSocket do aktualizacji w czasie rzeczywistym:
- **Alerty** - natychmiastowe powiadomienia o nowych alertach
- **Status urządzeń** - aktualizacje stanu połączeń
- **Dane pomiarowe** - real-time data streaming
- **Dashboard updates** - automatyczne odświeżanie widgetów

**Przykład użycia WebSocket hook:**
```typescript
const { isConnected, lastMessage } = useWebSocket(
  'ws://localhost:3001/ws/alerts',
  {
    onMessage: (data) => {
      if (data.type === 'alert_created') {
        // Obsłuż nowy alert
      }
    }
  }
);
```

### 📊 Dashboard Grid System
Zaawansowany system dashboardów z drag & drop:
- **Responsywny grid** - automatyczne dopasowanie
- **Drag & Drop** - przemieszczanie widgetów
- **Konfigurowalwe widżety** - gauge, charts, KPI, tables
- **Zapisywanie layoutów** - persistence w bazie danych

### 🚨 Advanced Alert Management
Kompleksowy system zarządzania alertami:
- **Acknowledgment** - potwierdzanie alertów przez użytkowników
- **Bulk operations** - operacje na wielu alertach
- **Filtrowanie** - po severity, status, kategoria
- **Webhook integracje** - automatyczne powiadomienia (Slack/Teams)
- **Template system** - predefiniowane typy alertów
- **Statistics** - szczegółowe statystyki alertów

### 🌳 Enhanced Hierarchical Tree
Zarządzanie strukturą urządzeń:
- **Lokalizacje** → **Obszary** → **Urządzenia** → **Punkty danych**
- **Drag & Drop reorganization** - przemieszczanie w hierarchii
- **Search & Filter** - szybkie wyszukiwanie
- **Status indicators** - wizualne wskaźniki stanu
- **Collapsible sidebar** - oszczędność miejsca

## 📈 Monitoring i metryki

### System Health Checks
- **Database connectivity** - MongoDB connection status
- **Protocol manager** - status wszystkich protokołów
- **WebSocket manager** - połączenia real-time
- **Memory usage** - wykorzystanie zasobów
- **Disk space** - dostępne miejsce

### Performance Metrics
- **Response times** - czasy odpowiedzi API
- **Data throughput** - przepustowość danych
- **Connection stability** - stabilność połączeń
- **Error rates** - częstotliwość błędów

### Alert Statistics
```json
{
  "total": 45,
  "active": 12,
  "acknowledged": 18,
  "resolved": 15,
  "by_severity": {
    "critical": 3,
    "high": 8,
    "medium": 15,
    "low": 12,
    "info": 7
  }
}
```

## 🔒 Bezpieczeństwo

### Authentication & Authorization
- **JWT tokens** - secure session management
- **Password policies** - wymuszone silne hasła  
- **Session timeouts** - automatyczne wylogowanie
- **API rate limiting** - ochrona przed abuse

### Data Protection
- **Encryption at rest** - szyfrowanie danych w bazie
- **TLS/SSL** - szyfrowane połączenia
- **Input validation** - walidacja wszystkich danych
- **SQL injection protection** - parametryzowane zapytania

## 🐛 Troubleshooting

### Typowe problemy

#### Backend nie startuje
```bash
# Sprawdź logi
docker-compose logs backend

# Sprawdź połączenie z bazą danych
mongo mongodb://localhost:27017/industrial_iot
```

#### Frontend nie łączy się z API
```bash
# Sprawdź zmienne środowiskowe
cat frontend/.env.local

# Sprawdź CORS w backend
curl -H "Origin: http://localhost:5173" \\
     -H "Access-Control-Request-Method: POST" \\
     http://localhost:3001/api/health
```

#### WebSocket nie działa
```bash
# Test WebSocket connection
wscat -c ws://localhost:3001/ws/alerts
```

## 📝 Changelog

### v1.0.0 (2025-11-01)
#### ✨ Nowe funkcje
- ✅ **WebSocket real-time updates** - automatyczne aktualizacje UI
- ✅ **Comprehensive alert system** - zarządzanie alertami z acknowledgment
- ✅ **Dashboard grid system** - drag & drop widgets
- ✅ **Hierarchical device management** - struktura drzewkowa z drag & drop
- ✅ **Historical data analysis** - analiza z agregacjami (raw/hourly/daily)
- ✅ **Health monitoring system** - kompleksowy monitoring stanu
- ✅ **Advanced settings** - konfiguracja na żywo z walidacją

#### 🔧 Ulepszenia techniczne
- ✅ **Removed all mock data** - wszystkie komponenty używają prawdziwych API
- ✅ **Fixed circular imports** - przepisane modele Beanie
- ✅ **Added missing dependencies** - psutil, httpx, UI components
- ✅ **Improved error handling** - graceful degradation
- ✅ **API route integration** - wszystkie endpointy podłączone do main.py

#### 🛠️ Protokoły
- ✅ **Modbus TCP/RTU** - kompletna implementacja
- ✅ **OPC-UA** - obsługa node browsing
- ✅ **MQTT** - pub/sub z QoS
- ✅ **EtherNet/IP** - Allen-Bradley compatibility
- ✅ **Profinet** - Siemens integration
- ✅ **CANopen** - embedded systems support
- ✅ **BACnet** - building automation

## 🔧 Rozwój i customizacja

### Dodawanie nowych protokołów
1. Utwórz implementację w `backend/services/protocol_services/`
2. Dodaj konfigurację do `protocol_services.py`
3. Zaktualizuj frontend form w `AddProtocolDialog.tsx`

### Custom widgets dla dashboardów
1. Utwórz komponent w `frontend/src/components/widgets/`
2. Zarejestruj w `DashboardGrid.tsx`
3. Dodaj konfigurację w backend API

### Webhook integracje
System wspiera webhook integracje dla:
- **Slack** - powiadomienia na kanały
- **Microsoft Teams** - integracja z Teams
- **Email** - alerty przez email  
- **Custom endpoints** - własne integracje

## 🤝 Contributing

### Development workflow
1. Fork repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`  
5. Submit Pull Request

### Code style
- **Backend:** Black + isort formatting
- **Frontend:** Prettier + ESLint
- **Commits:** Conventional commits format

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Arek Wilczek** - *Initial work* - [@crocco93](https://github.com/crocco93)

## 🙏 Acknowledgments

- FastAPI community for excellent documentation
- React community for component patterns
- Industrial automation protocols communities
- MongoDB team for Beanie ODM
- Tailwind CSS for utility-first styling

---

## 📞 Support

Jeśli masz pytania lub problemy:

1. **Dokumentacja API:** http://localhost:3001/docs
2. **GitHub Issues:** https://github.com/crocco93/industrial-iot-full-stack/issues
3. **Email:** arekwilczek93@outlook.com

---

**Made with ❤️ for Industrial IoT**

Last updated: November 1, 2025