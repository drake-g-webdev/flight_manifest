/**
 * Flight Manifest Builder - Backend API Server
 *
 * Express server with REST API for flight manifest automation.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import operatorsRoutes from './routes/operators.js';
import aircraftRoutes from './routes/aircraft.js';
import flightsRoutes from './routes/flights.js';
import passengersRoutes from './routes/passengers.js';
import freightRoutes from './routes/freight.js';
import mailRoutes from './routes/mail.js';
import optimizeRoutes from './routes/optimize.js';
import manifestsRoutes from './routes/manifests.js';
import stationsRoutes from './routes/stations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Static file serving for PDFs
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/operators', operatorsRoutes);
app.use('/api/aircraft', aircraftRoutes);
app.use('/api/flights', flightsRoutes);
app.use('/api/passengers', passengersRoutes);
app.use('/api/freight', freightRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/manifests', manifestsRoutes);
app.use('/api/stations', stationsRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Flight Manifest Builder API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'User login',
        'POST /api/auth/register': 'Register new user',
        'GET /api/auth/me': 'Get current user',
        'PUT /api/auth/password': 'Change password',
      },
      aircraft: {
        'GET /api/aircraft': 'List all aircraft',
        'GET /api/aircraft/:id': 'Get aircraft by ID',
        'POST /api/aircraft': 'Create aircraft (Admin)',
        'PUT /api/aircraft/:id': 'Update aircraft (Admin)',
      },
      flights: {
        'GET /api/flights': 'List flights (filter by date, status)',
        'GET /api/flights/:id': 'Get flight with full details',
        'POST /api/flights': 'Create flight',
        'PUT /api/flights/:id': 'Update flight',
        'DELETE /api/flights/:id': 'Cancel flight',
      },
      passengers: {
        'GET /api/passengers': 'List passengers (filter by flight, destination)',
        'GET /api/passengers/:id': 'Get passenger',
        'POST /api/passengers': 'Create passenger',
        'PUT /api/passengers/:id': 'Update passenger',
        'DELETE /api/passengers/:id': 'Delete passenger',
        'POST /api/passengers/:id/assign': 'Assign to flight',
      },
      freight: {
        'GET /api/freight': 'List freight items',
        'GET /api/freight/:id': 'Get freight item',
        'POST /api/freight': 'Create freight item',
        'PUT /api/freight/:id': 'Update freight item',
        'DELETE /api/freight/:id': 'Delete freight item',
      },
      mail: {
        'GET /api/mail': 'List mail items',
        'GET /api/mail/:id': 'Get mail item',
        'POST /api/mail': 'Create mail item',
        'PUT /api/mail/:id': 'Update mail item',
        'DELETE /api/mail/:id': 'Delete mail item',
      },
      optimize: {
        'POST /api/optimize': 'Run optimization for date',
        'POST /api/optimize/apply': 'Apply optimization result',
        'GET /api/optimize/logs': 'Get optimization history',
      },
      manifests: {
        'GET /api/manifests': 'List manifests',
        'GET /api/manifests/:id': 'Get manifest',
        'POST /api/manifests/generate': 'Generate manifest for flight',
        'POST /api/manifests/generate-batch': 'Generate manifests for date',
        'GET /api/manifests/:id/pdf': 'Get manifest PDF',
        'POST /api/manifests/:id/sign': 'Sign manifest',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   Sukakpak Manifest Generator API                     ║
  ║   Running on http://localhost:${PORT}                    ║
  ║                                                       ║
  ║   Endpoints: /api                                     ║
  ║   Health: /health                                     ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;
