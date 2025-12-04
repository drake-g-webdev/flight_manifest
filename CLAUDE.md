# CLAUDE.md - Flight Manifest Builder

## Project Overview

Flight Manifest Builder is an automated manifest generation system for bush airlines in Alaska. It features AI-powered optimization via Claude, Weight & Balance (W&B) calculations, and PDF manifest generation. The system manages multi-operator flight operations including passengers, freight, and USPS mail assignments.

## Tech Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **ORM**: Prisma with PostgreSQL
- **AI Integration**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **PDF Generation**: Puppeteer
- **Authentication**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod for schema validation
- **Job Queue**: BullMQ with Redis (optional)

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: Zustand (persisted stores)
- **HTTP Client**: Axios
- **Charts**: Recharts
- **UI Components**: Headless UI + Heroicons

## Directory Structure

```
flight_manifest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (PostgreSQL)
│   │   └── seed.ts          # Sample data seeding
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── middleware/      # Auth middleware (JWT validation)
│   │   ├── routes/          # Express route handlers
│   │   │   ├── auth.ts      # Authentication endpoints
│   │   │   ├── flights.ts   # Flight CRUD + W&B
│   │   │   ├── passengers.ts
│   │   │   ├── freight.ts
│   │   │   ├── mail.ts
│   │   │   ├── optimize.ts  # Optimization endpoints
│   │   │   ├── manifests.ts # PDF generation
│   │   │   ├── aircraft.ts
│   │   │   ├── operators.ts
│   │   │   └── stations.ts
│   │   ├── services/        # Core business logic
│   │   │   ├── weightBalance.ts     # W&B calculations
│   │   │   ├── baselineOptimizer.ts # Greedy assignment algorithm
│   │   │   ├── claudeOptimizer.ts   # Claude AI integration
│   │   │   └── pdfGenerator.ts      # Manifest PDF generation
│   │   ├── types/           # TypeScript type definitions
│   │   └── index.ts         # Server entry point (port 3001)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared React components
│   │   │   ├── Layout.tsx   # Main app layout with navigation
│   │   │   └── OperatorSwitcher.tsx
│   │   ├── pages/           # Route page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Flights.tsx / FlightDetail.tsx
│   │   │   ├── Passengers.tsx
│   │   │   ├── Freight.tsx / Mail.tsx
│   │   │   ├── Optimize.tsx
│   │   │   ├── Manifests.tsx
│   │   │   ├── Fleet.tsx
│   │   │   ├── Stations.tsx
│   │   │   └── Login.tsx
│   │   ├── services/
│   │   │   └── api.ts       # Axios API client with interceptors
│   │   ├── store/           # Zustand stores
│   │   │   ├── authStore.ts
│   │   │   └── operatorStore.ts
│   │   ├── types/           # Frontend TypeScript types
│   │   ├── App.tsx          # React Router configuration
│   │   └── main.tsx         # Application entry point
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
└── package.json             # Root package with workspaces
```

## Development Commands

### Quick Start
```bash
# Install all dependencies (root, backend, frontend)
npm run install:all

# Set up database
npm run db:setup   # Runs generate + migrate + seed

# Start development servers (both backend and frontend)
npm run dev
```

### Backend Commands (from /backend)
```bash
npm run dev           # Start dev server with hot reload (tsx watch)
npm run build         # TypeScript compile to dist/
npm run start         # Run production build
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run database migrations
npm run db:push       # Push schema changes (development)
npm run db:seed       # Seed sample data
npm run test          # Run tests with Vitest
npm run test:coverage # Run tests with coverage
```

### Frontend Commands (from /frontend)
```bash
npm run dev      # Start Vite dev server (port 3000)
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

## Environment Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/flight_manifest_db"
JWT_SECRET="your-secret-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional
REDIS_URL="redis://localhost:6379"
CLAUDE_MODEL="claude-sonnet-4-20250514"
PORT=3001
NODE_ENV="development"
PDF_STORAGE_PATH="./storage/manifests"

# Standard weights (regulatory defaults)
STANDARD_ADULT_WEIGHT_KG=88
STANDARD_CHILD_WEIGHT_KG=35
STANDARD_BAGGAGE_WEIGHT_KG=10
```

## Database Schema (Key Models)

### Core Entities
- **Operator**: Airlines/air services (multi-tenant support)
- **Station**: Airports/bases with timezone info
- **Aircraft**: Fleet with W&B configuration (seats, compartments, CG limits)
- **Flight**: Daily flight schedules with multi-leg routes
- **Passenger**: Bookings with weight, priority, seat assignment
- **Freight**: Cargo items with waybill, weight, compartment
- **MailManifest**: USPS mail bags (pounds converted to kg)
- **Manifest**: Generated PDF manifests with version history
- **User**: Authentication with role-based access (ADMIN, OPS, PILOT)

### Key Relationships
- All entities are scoped by `operatorId` for multi-tenant isolation
- Flights reference Aircraft via `tailId`
- Passengers/Freight/Mail can be assigned to flights
- Manifests are versioned per flight

## API Conventions

### Response Format
All API responses follow this structure:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}
```

### Authentication
- JWT tokens in `Authorization: Bearer <token>` header
- Tokens expire in 24 hours by default
- 401 responses trigger automatic logout on frontend

### Key Endpoints
- `POST /api/auth/login` - Login
- `GET /api/flights?date=YYYY-MM-DD` - List flights by date
- `GET /api/flights/:id` - Flight detail with W&B calculation
- `POST /api/optimize` - Run optimization for a date
- `POST /api/manifests/generate` - Generate manifest PDF

## Weight & Balance System

The W&B calculator (`backend/src/services/weightBalance.ts`) is the core safety component:

### Validation Rules
1. Total weight must not exceed Maximum Takeoff Weight (MTOW)
2. Center of Gravity (CG) must stay within aircraft envelope (cgMin to cgMax)
3. Compartment weights must not exceed capacity
4. Seat weight limits are enforced

### Calculation Flow
```
totalWeight = emptyWeight + pilotWeight + fuelWeight + passengers + baggage + freight + mail
CG = totalMoment / totalWeight
moment = weight × arm (distance from datum)
```

### Auto-Assignment Strategies
- **Seats**: Heavier passengers alternate front/back for CG balance
- **Compartments**: Fill evenly, prioritizing items with highest priority

## Optimization System

Two-tier optimization approach:

### 1. Baseline Algorithm (`baselineOptimizer.ts`)
Fast greedy assignment that:
- Processes items by priority: EVAC > MEDICAL > BYPASS mail > FIRST_CLASS > PRIORITY > NORMAL > STANDARD
- Assigns to earliest flight serving the destination
- Validates W&B after each assignment
- Tracks unassigned items

### 2. Claude Optimization (`claudeOptimizer.ts`)
Called when baseline fails or for complex scenarios:
- Analyzes entire problem space
- Suggests moves and reassignments
- Provides explanations for decisions
- All results validated against W&B constraints before acceptance

## Code Conventions

### TypeScript
- Strict mode enabled
- Explicit types preferred over inference for function parameters
- Use Zod for runtime validation of external data

### Backend
- Route handlers should catch errors and return proper ApiResponse
- Use Prisma transactions for multi-step operations
- All dates stored in UTC, timezone conversion happens on display

### Frontend
- Components use functional style with hooks
- State management via Zustand stores (persisted to localStorage)
- API calls through centralized `api.ts` service
- Tailwind CSS for styling (no custom CSS unless necessary)

### Naming Conventions
- Database columns: snake_case (mapped via Prisma `@map`)
- TypeScript: camelCase for variables, PascalCase for types/interfaces
- API endpoints: kebab-case for multi-word resources
- Files: PascalCase for React components, camelCase for utilities

## Testing

Backend uses Vitest:
```bash
cd backend && npm run test
```

Tests should cover:
- W&B calculations (edge cases for CG envelope)
- Optimization algorithms
- API endpoint responses

## Common Tasks for AI Assistants

### Adding a New API Endpoint
1. Create or update route file in `backend/src/routes/`
2. Add types to `backend/src/types/index.ts`
3. Register route in `backend/src/index.ts`
4. Add API method in `frontend/src/services/api.ts`
5. Add frontend types in `frontend/src/types/index.ts`

### Modifying Database Schema
1. Update `backend/prisma/schema.prisma`
2. Run `npm run db:generate` to update Prisma client
3. Run `npm run db:migrate` to create migration
4. Update seed data if needed in `prisma/seed.ts`

### Adding a New Page
1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in `frontend/src/components/Layout.tsx`

### Working with W&B Calculations
- All W&B logic is in `backend/src/services/weightBalance.ts`
- Never bypass W&B validation - safety critical
- Test edge cases: empty flights, full capacity, CG at limits

## Security Notes

- Never commit `.env` files
- API keys should be environment variables
- All user input validated via Zod schemas
- SQL injection prevented by Prisma parameterized queries
- XSS prevented by React's automatic escaping

## Demo Accounts (Development)

| Email | Password | Role |
|-------|----------|------|
| admin@sukakpak.com | password123 | Admin |
| ops@sukakpak.com | password123 | Ops |
| pilot@sukakpak.com | password123 | Pilot |
