# IPDashboard

A full-stack React + Node.js/Express application for sales data management, budget forecasting, and business analytics.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install
```

### Running the Application

```bash
# Start backend server (from server/ directory)
cd server
npm start        # Production
npm run dev      # Development with auto-reload

# Start frontend (from root directory)
npm start
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api-docs

## 📁 Project Structure

```
IPD06.12/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── utils/              # Utilities (authClient.js)
│   └── ...
├── public/                 # Static assets
├── server/                 # Express backend
│   ├── index.js            # Entry point
│   ├── config/             # Configuration files
│   │   ├── express.js      # Express setup
│   │   ├── database.js     # PostgreSQL connection
│   │   ├── environment.js  # Environment validation
│   │   ├── swagger.js      # API documentation
│   │   ├── sentry.js       # Error tracking
│   │   └── alerting.js     # Alerting config
│   ├── routes/             # API routes (32 modules)
│   │   ├── auth.js         # Authentication
│   │   ├── aebf/           # Advanced Excel Budget & Forecast
│   │   ├── admin.js        # Admin operations
│   │   └── ...
│   ├── middleware/         # Express middleware (13 modules)
│   │   ├── auth.js         # JWT authentication
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── security.js     # Security headers
│   │   ├── cache.js        # Redis caching
│   │   └── ...
│   ├── tests/              # Jest test suites
│   └── scripts/            # Utility scripts
└── docs/                   # Documentation
```

## 🔐 Authentication

JWT-based authentication with refresh tokens:
- Access tokens: 15 minute expiry
- Refresh tokens: 60 day expiry (HTTP-only cookie)
- Auto-refresh on 401 responses

## 🛡️ Security Features

- Helmet.js security headers
- Rate limiting (100 req/15min)
- CORS configuration
- Request correlation IDs
- Input validation

## 📊 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/auth/*` | Authentication |
| `/api/aebf/*` | Budget & Forecast |
| `/api/fp/*` | FP Division data |
| `/api/hc/*` | HC Division data |
| `/api/sales-reps/*` | Sales representatives |
| `/api/master-data/*` | Master data management |
| `/api/health` | Health check |
| `/api/metrics` | Prometheus metrics |

## 🧪 Testing

```bash
cd server
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:unit     # Unit tests only
```

## 📝 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fp_database
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=your_secret_key

# Optional
REDIS_URL=redis://localhost:6379
SENTRY_DSN=your_sentry_dsn
```

## 📚 Documentation

See the `docs/` folder for detailed documentation on:
- Feature implementations
- Bug fixes
- Architecture decisions
- API specifications

## 🔧 Scripts

Utility scripts are located in `server/scripts/`:
- `backup-database.sh` - Database backup
- `setup-database.sh` - Database setup
- `setup.sh` - Initial setup

## License

Private - All rights reserved
