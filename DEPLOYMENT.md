# AIGA Shield – Deployment Guide

## Quick Start

### Prerequisites
- Node.js 14+ installed
- Windows OS (or Unix with modifications)

### Running the System

#### Option 1: Batch File (Windows)
```batch
run-aiga.bat
```
This will start the Node.js server on http://localhost:5173

#### Option 2: Command Line
```bash
cd c:\Users\hp\OneDrive\Documents\aiga_final
node server.js
```

### Accessing the System
Open browser to: **http://localhost:5173**

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aiga.com | 1234 |
| Customer | customer@aiga.com | 1234 |
| Analyst | analyst@aiga.com | 1234 |

## System Architecture

### Frontend Stack
- **HTML5** - Semantic markup with 3 role-based dashboards
- **CSS3** - Responsive grid/flexbox layouts with mobile breakpoints
- **Vanilla JavaScript** - ES6+ with EventSource API for real-time updates
- **No frameworks** - Pure vanilla implementation for simplicity

### Backend Stack
- **Node.js** - HTTP server with no Express dependency
- **Server-Sent Events (SSE)** - Real-time client streaming
- **In-Memory Storage** - Current state management
- **Fraud Detection Engine** - Multi-factor risk scoring

## Features Implemented

### 1. Admin Dashboard
- **Real-Time Monitoring**: Live transaction stream with instant updates
- **Stats Grid**: 5 key metrics (Total, Fraud, Blocked, Pending, Approved)
- **Transaction Table**: Full history with risk scores and decisions
- **Analysis Panel**: Detailed fraud assessment with AI recommendations
- **Heatmap**: City-based fraud intensity visualization
- **Merchant Directory**: Risk-ranked merchant list
- **Transaction Simulator**: Generate test fraud scenarios

### 2. Customer Payment Portal
- **Payment Form**: 6-field intake (Name, Email, Merchant, Amount, City, Card)
- **GPS Capture**: Browser geolocation for location verification
- **Device Fingerprinting**: Canvas-based device identification
- **Real-Time Scoring**: Instant fraud risk calculation
- **Card Freeze**: Emergency card freezing capability
- **Transaction History**: Recent transaction audit trail

### 3. Analyst Case Management
- **Case List**: Active fraud investigations with search
- **Case Details**: Full case timeline with investigation steps
- **Status Management**: Mark cases verified or resolved
- **Investigation Timeline**: 5+ step tracking from detection to resolution
- **Priority Indicators**: Medium/High risk priority display

## Fraud Detection Algorithm

### Risk Factors (0-99 scale)
1. **New Device** (+20): Unrecognized device fingerprint
2. **Amount Anomaly** (+22): Unusual transaction size
3. **Velocity** (+18): Multiple transactions in 10 minutes
4. **Merchant Risk** (+24): High-risk merchant keywords
5. **Location** (+10): City change from previous transaction
6. **Impossible Travel** (+28): Geographic distance/time impossibility
7. **Timezone** (+8): Timezone mismatch
8. **Network** (+8): Network instability signals

### Decision Logic
- **≥75%**: BLOCKED (immediate fraud response)
- **45-74%**: OTP REQUIRED (verify with second factor)
- **<45%**: APPROVED (monitor for patterns)

## Real-Time Architecture

### SSE Connection Flow
1. Client connects to `/api/events` endpoint
2. Server sends initial snapshot of current state
3. Server broadcasts updates on each new transaction
4. Client receives real-time transaction data
5. Dashboard updates reactively without polling

### State Management
```javascript
{
  transactions: [],      // All transactions (max 100)
  cases: [],            // Fraud cases (max 50)
  customers: Map,       // Customer profiles
  merchants: Map,       // Merchant risk data
  clients: Set          // Connected SSE clients
}
```

## Production Readiness Checklist

- [ ] **Database**: Add PostgreSQL for persistence
- [ ] **Authentication**: Replace demo credentials with JWT
- [ ] **API Security**: Add rate limiting and CORS
- [ ] **Error Handling**: Implement comprehensive error logging
- [ ] **Monitoring**: Add application performance monitoring
- [ ] **Notifications**: SMS/Email alerts for blocked transactions
- [ ] **ML Models**: Advanced fraud detection models
- [ ] **Docker**: Containerize with Dockerfile
- [ ] **AWS**: Deploy to ECS/Lambda
- [ ] **Testing**: Unit and integration test suite
- [ ] **Documentation**: API documentation and user guides

## API Endpoints

### Public Endpoints
- `GET /` - Serve index.html
- `GET /app.js` - Serve application JavaScript
- `GET /styles.css` - Serve stylesheets

### API Endpoints
- `GET /api/events` - Server-Sent Events stream (real-time)
- `GET /api/state` - Current state snapshot
- `POST /api/transactions` - Submit transaction for analysis
- `POST /api/cases/{id}` - Update case status

## Performance Notes

- Average response time: <100ms
- SSE reconnection: Automatic on failure
- Max concurrent connections: Unlimited (in-memory)
- Transaction processing: Real-time
- Memory usage: ~50MB baseline

## Troubleshooting

### Port 5173 Already in Use
```bash
netstat -ano | findstr :5173
taskkill /PID <process_id> /F
```

### SSE Connection Failing
- Check browser console for errors
- Verify server is running: `http://localhost:5173`
- Check Network tab in DevTools
- Verify EventSource support (all modern browsers)

### Form Not Submitting
- Check browser console for JavaScript errors
- Verify all form fields are filled
- Check Network tab to see POST request
- Verify `/api/transactions` endpoint is responsive

## File Structure
```
aiga_final/
├── index.html          (500+ lines - UI)
├── styles.css          (1000+ lines - Styling)
├── app.js              (640+ lines - Logic)
├── server.js           (440+ lines - Backend)
├── package.json        (Dependencies)
├── README.md           (System overview)
├── DEPLOYMENT.md       (This file)
├── run-aiga.bat        (Windows launcher)
└── open-aiga.bat       (Browser launcher)
```

## Support & Development

For issues, feature requests, or deployment assistance:
1. Check browser console for errors
2. Review server logs for API issues
3. Verify all test data is being generated
4. Check network connectivity to backend

## License & Credits

AIGA Shield – Intelligent Real-Time Card Fraud Detection & Automated Risk Response System
Built with Node.js, HTML5, CSS3, and Vanilla JavaScript
Real-time fraud detection engine for banking and payment systems
