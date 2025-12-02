# Flight Manifest Builder

An automated manifest generation system for bush airlines, featuring AI-powered optimization via Claude, Weight & Balance calculations, and PDF manifest generation.

## Features

- **Daily Dashboard**: View and manage flights, passengers, freight, and mail for any date
- **Weight & Balance**: Real-time W&B calculations with CG envelope validation
- **AI Optimization**: Claude-powered assignment optimization with fallback to baseline greedy algorithm
- **PDF Manifests**: Professional manifest generation with all required fields
- **Role-Based Access**: Admin, Ops, and Pilot roles with appropriate permissions
- **Audit Trail**: Complete history of assignments and manifest versions

## Tech Stack

### Backend
- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL
- Anthropic Claude API for optimization
- Puppeteer for PDF generation
- JWT authentication

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- React Router
- Zustand for state management
- Recharts for visualizations

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for job queue)
- Anthropic API key

### Installation

1. Clone the repository and install dependencies:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

2. Set up environment variables:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit .env with your database URL and Anthropic API key
```

3. Set up the database:

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

4. Start the development servers:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

5. Open http://localhost:3000 in your browser

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@sukakpak.com | password123 | Admin |
| ops@sukakpak.com | password123 | Ops |
| pilot@sukakpak.com | password123 | Pilot |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register user
- `GET /api/auth/me` - Get current user

### Flights
- `GET /api/flights` - List flights (filter by date, status)
- `GET /api/flights/:id` - Get flight details with W&B
- `POST /api/flights` - Create flight
- `PUT /api/flights/:id` - Update flight
- `DELETE /api/flights/:id` - Cancel flight

### Passengers
- `GET /api/passengers` - List passengers
- `POST /api/passengers` - Create passenger
- `PUT /api/passengers/:id` - Update passenger
- `POST /api/passengers/:id/assign` - Assign to flight

### Freight & Mail
- `GET /api/freight` - List freight
- `POST /api/freight` - Create freight
- `GET /api/mail` - List mail
- `POST /api/mail` - Create mail

### Optimization
- `POST /api/optimize` - Run optimization for date
- `POST /api/optimize/apply` - Apply optimization result

### Manifests
- `GET /api/manifests` - List manifests
- `POST /api/manifests/generate` - Generate manifest
- `POST /api/manifests/generate-batch` - Generate all manifests for date
- `GET /api/manifests/:id/pdf` - Download PDF

## Weight & Balance

The W&B calculator validates:
- Total weight vs MTOW
- Center of gravity within envelope
- Compartment capacity limits
- Seat weight limits

Calculations are deterministic and run in the backend. Claude proposes assignments, but all results are validated before acceptance.

## Optimization Strategy

1. **Baseline Algorithm**: Fast greedy assignment
   - Prioritizes medical/evac passengers and bypass mail
   - Assigns to earliest flights with matching destinations
   - Validates W&B after each assignment

2. **Claude Optimization**: Called when baseline fails or for complex scenarios
   - Analyzes entire problem space
   - Suggests moves and reassignments
   - Provides explanations for decisions
   - Results validated against W&B constraints

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Database config
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   │   ├── weightBalance.ts    # W&B calculations
│   │   │   ├── baselineOptimizer.ts # Greedy algorithm
│   │   │   ├── claudeOptimizer.ts   # Claude integration
│   │   │   └── pdfGenerator.ts      # PDF generation
│   │   ├── types/          # TypeScript types
│   │   └── index.ts        # Server entry
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.ts         # Sample data
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Shared components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── store/          # Zustand stores
│   │   └── types/          # TypeScript types
│   └── public/
│
└── README.md
```

## Configuration

### Aircraft Setup

Aircraft are configured with:
- W&B parameters (empty weight, arm, CG limits)
- Seat configuration (number, arms, weight limits)
- Baggage compartments (name, capacity, arm)

Example in `prisma/seed.ts`:
```typescript
{
  tail: 'N12345',
  type: 'C208B',
  maxTakeoffKg: 3629,
  emptyWeightKg: 2145,
  cgLimits: { cgMin: 2.3, cgMax: 2.9 },
  seatConfiguration: [
    { seat: 1, arm: 1.5, maxWeightKg: 136 },
    // ...
  ],
  baggageCompartments: [
    { name: 'Forward', capacityKg: 136, arm: 1.0 },
    // ...
  ]
}
```

### Standard Weights

Configure in `.env`:
```
STANDARD_ADULT_WEIGHT_KG=88
STANDARD_CHILD_WEIGHT_KG=35
STANDARD_BAGGAGE_WEIGHT_KG=10
```

## License

Proprietary - OpenSky Custom Software Solutions
