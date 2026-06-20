# WasteMarket

WasteMarket is a full-stack B2B waste marketplace platform that digitally connects:
- Producers (waste generators)
- Transporters (logistics operators)
- Recipients (treatment plants / landfills)

It replaces traditional intermediation with a reverse auction workflow and real-time notifications.

## Tech Stack

- Frontend: React 18, React Router v6, Tailwind CSS, React Query, Axios, Socket.io-client
- Backend: Node.js, Express, Sequelize ORM, JWT auth, bcrypt, Socket.io
- Database: PostgreSQL
- Tooling: Docker Compose, ESLint, Prettier, nodemon

## Project Structure

```text
WasteMarket/
  client/
  server/
  docker-compose.yml
  README.md
```

### Frontend Key Paths

```text
client/src/pages/auth
client/src/pages/producer
client/src/pages/transporter
client/src/pages/recipient
client/src/pages/admin
client/src/components/ui
client/src/components/auction
client/src/components/map
client/src/components/forms
client/src/components/shared
client/src/hooks
client/src/context
```

### Backend Key Paths

```text
server/src/routes
server/src/controllers
server/src/services
server/src/models
server/src/middleware
server/src/websocket
server/src/config
```

## Core Features Implemented

- Multi-role authentication scaffold (producer, transporter, recipient, admin)
- Producer workflows:
  - Create waste request
  - CER searchable selector
  - Price estimate preview
  - Active orders and history placeholders
  - Auction room with live bid board and countdown
- Transporter workflows:
  - Compatible request feed
  - Bid submission placeholder
  - Active jobs and earnings views
- Recipient workflows:
  - Matching notification feed
  - CER pricing and capacity placeholders
  - Incoming shipment tracker
- Admin workflows:
  - User verification endpoints
  - Analytics endpoint
  - Compliance/RENTri placeholder endpoint
- Matching engine service placeholder with operator compatibility
- Pricing calculator service with CER hazard, distance, urgency multiplier
- Reverse auction close manager with transaction fee calculation
- Realtime WebSocket namespaces:
  - `/auctions`
  - `/notifications`
- Document/compliance placeholders (FIR download surfaces in UI, archive sections)
- Business model placeholders:
  - Subscription tracking (`users.subscription_plan`)
  - Premium features flag (`users.premium_features_enabled`)
  - Transaction fee (`transactions.platform_fee`)

## Environment Files

Copy examples and customize:

- `client/.env.example` -> `client/.env`
- `server/.env.example` -> `server/.env`

## Local Setup (without Docker)

Prerequisites:
- Node.js 20+
- npm
- PostgreSQL 16+

1. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

2. Create env files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

3. Start backend

```bash
cd server
npm run dev
```

4. Start frontend

```bash
cd client
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

## Docker Setup

1. Create env files from examples.
2. Run:

```bash
docker compose up --build
```

Services:
- Client: http://localhost:5173
- Server: http://localhost:5000
- Postgres: localhost:5432

## API Overview

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Producer
  - `POST /api/producers/waste-requests`
  - `POST /api/producers/pricing/estimate`
  - `GET /api/producers/orders/active`
  - `GET /api/producers/orders/history`
  - `GET /api/producers/auctions/:id`
- Transporter
  - `GET /api/transporters/notifications`
  - `GET /api/transporters/jobs`
  - `GET /api/transporters/earnings`
- Recipient
  - `GET /api/recipients/notifications`
  - `POST /api/recipients/pricing`
  - `POST /api/recipients/capacity`
  - `GET /api/recipients/incoming`
- Auctions and bids
  - `GET /api/auctions/:wasteRequestId`
  - `POST /api/auctions/:wasteRequestId/close`
  - `POST /api/bids`
  - `GET /api/bids/:wasteRequestId`
- Admin
  - `GET /api/admin/users/pending`
  - `PATCH /api/admin/users/:userId/verify`
  - `GET /api/admin/analytics`
  - `GET /api/admin/compliance`

## Notes

- Map components are functional placeholders ready for Leaflet integration.
- FIR and RENTri integrations are scaffolded as placeholders for compliance-phase implementation.
- The frontend currently uses local mock login state to ease UI navigation; wire it to `/api/auth/*` for production.
