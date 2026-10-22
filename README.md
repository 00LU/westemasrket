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
  - Create / publish pickup requests (draft -> published)
  - CER searchable selector and price estimate preview
  - Follow recipients' availability and transporters' proposals, pick one of the best packages, agree day/time
- Transporter workflows:
  - Invitations only for requests with at least one available recipient
  - Transport proposal (acts as an auction), agreement on day/time, earnings
- Recipient workflows:
  - Pickup invitations and availability confirmation (price per ton, destination)
  - Agreement on day/time, CER pricing and capacity placeholders
- Admin workflows:
  - User verification endpoints
  - Analytics endpoint
  - Compliance/RENTri placeholder endpoint
- Pricing calculator service with CER hazard, distance, urgency multiplier
- Realtime notifications: persisted in DB and pushed only to the addressed user (authenticated socket namespace `/notifications`)
- Document/compliance placeholders (FIR download surfaces in UI, archive sections)
- Business model placeholders:
  - Subscription tracking (`users.subscription_plan`)
  - Premium features flag (`users.premium_features_enabled`)
  - Transaction fee (`pickup_transactions.platform_fee`), recorded when a pickup is confirmed

## Pickup Flow

Roles: Producer, Recipient (Destinatario), Transporter (Trasportatore).

1. The producer creates a request (`draft`) and publishes it -> `awaiting_recipients`; verified recipients are notified.
2. Recipients confirm (price/ton + destination) or decline. When all have answered (or the producer closes the phase, with at least one available recipient) -> `awaiting_transporters`. If nobody is available the request is `cancelled` and transporters are never notified.
3. Transporters are notified only now and submit a price (or decline). When all have answered (or the producer closes the auction) -> `packages_ready`.
4. The platform builds packages (available recipient x transport proposal) and ranks them in [`packageOptimizer.js`](server/src/services/packageOptimizer.js). Today the criterion is the lowest total price; add a strategy to `STRATEGIES` (and set `PACKAGE_OPTIMIZATION_STRATEGY`) to move to a mixed price/distance/time score. The producer sees the best `PACKAGES_TOP_N` (default 5).
5. The producer selects a package -> `in_agreement`.
6. The producer proposes day/time; recipient and transporter accept or counter-propose (a new proposal supersedes the previous one and resets acceptances). Only when all three accepted the same slot -> `confirmed`.
7. If the recipient or transporter refuses, or does not answer within `AGREEMENT_RESPONSE_HOURS` (default 48), the package is discarded and the request goes back to `packages_ready` with the remaining packages (`cancelled` if none is left). The producer can also withdraw its choice.

Request states: `draft`, `awaiting_recipients`, `awaiting_transporters`, `packages_ready`, `in_agreement`, `confirmed`, `cancelled` (publication opens the recipient phase immediately, so "published" and "awaiting recipients" are the same state). Allowed transitions live in [`pickupFlow.js`](server/src/config/pickupFlow.js) and are enforced by [`pickupStateMachine.js`](server/src/services/pickupStateMachine.js); every change is stored in `pickup_status_history`.

Each role only receives its own data (see [`pickupViews.js`](server/src/services/pickupViews.js)): max price and all offers are visible to the producer only; recipients never see transport prices and transporters never see treatment prices.

## Tests

```bash
cd server
npm test
```

Runs the whole flow (including refusal and timeout) against PostgreSQL in a temporary schema that is dropped at the end.

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
- Producer (`/api/producers`)
  - `POST /pricing/estimate`
  - `GET|POST /pickups`, `GET|PATCH /pickups/:id` (PATCH only while draft)
  - `POST /pickups/:id/publish`
  - `POST /pickups/:id/close-recipients`, `POST /pickups/:id/close-transporters`
  - `POST /pickups/:id/packages/:packageId/select`
  - `POST /pickups/:id/withdraw-selection`, `POST /pickups/:id/cancel`
- Recipient (`/api/recipients`)
  - `GET /pickups`, `GET /pickups/:id`
  - `POST /pickups/:id/availability` (`{ available, pricePerTon, destinationAddress, availableCapacityTon?, notes? }`)
  - `POST /pricing`, `POST /capacity` (placeholders)
- Transporter (`/api/transporters`)
  - `GET /pickups`, `GET /pickups/:id`
  - `POST /pickups/:id/proposal` (`{ price, vehicleType?, availabilityNote? }` or `{ decline: true }`)
  - `GET /earnings`
- Agreement on day/time, all three roles (`/api/pickups`)
  - `POST /:id/slots` (`{ scheduledAt }`: proposal or counter-proposal)
  - `POST /:id/slots/:slotId/accept`
  - `POST /:id/reject` (recipient / transporter refuse the selected package)
- Notifications (`/api/notifications`)
  - `GET /`, `PATCH /:id/read`, `POST /read-all`
- Admin
  - `GET /api/admin/users/pending`
  - `PATCH /api/admin/users/:userId/verify`
  - `GET /api/admin/analytics`
  - `GET /api/admin/compliance`

## Notes

- Map components are functional placeholders ready for Leaflet integration.
- FIR and RENTri integrations are scaffolded as placeholders for compliance-phase implementation.
- The frontend currently uses local mock login state to ease UI navigation; wire it to `/api/auth/*` for production.
