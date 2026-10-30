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

Request details group waste description, quantity, CER/EER, pickup location and
date into labelled blocks, followed by operational details and photos. The shared
request list retains its tabular layout with status, next-step guidance and
links to the full details.

Sessions are validated against `/api/auth/me` before protected pages render, including
after a page reload. Invalid sessions return to login; temporary verification failures
are shown explicitly. Logout and account changes clear the previous account's query cache.

- Multi-role authentication scaffold (producer, transporter, recipient, admin)
- Producer workflows:
  - Create / publish pickup requests with kg or liter quantities, structured addresses and photo attachments
  - CER searchable selector and price estimate preview
  - Follow recipients' availability and transporters' proposals, pick one of the best packages, agree day/time
- Transporter workflows:
  - Invitations only for requests with at least one available recipient
  - Transport proposal (acts as an auction), agreement on day/time, earnings
- Recipient workflows:
  - Pickup invitations and availability confirmation (price in the producer's selected unit, destination)
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
2. Recipients confirm (unit price in the producer's selected kg/liter unit + destination) or decline. When all have answered (or the producer closes the phase, with at least one available recipient) -> `awaiting_transporters`. If nobody is available the request is `cancelled` and transporters are never notified.
3. Transporters are notified only now and submit a price (or decline). When all have answered (or the producer closes the auction) -> `packages_ready`.
4. The platform builds packages (available recipient x transport proposal) and ranks them in [`packageOptimizer.js`](server/src/services/packageOptimizer.js). Today the criterion is the lowest total price; add a strategy to `STRATEGIES` (and set `PACKAGE_OPTIMIZATION_STRATEGY`) to move to a mixed price/distance/time score. The producer sees the best `PACKAGES_TOP_N` (default 5).
5. The producer selects a package -> `in_agreement`.
6. The producer proposes day/time; recipient and transporter accept or counter-propose (a new proposal supersedes the previous one and resets acceptances). Only when all three accepted the same slot -> `confirmed`.
7. Recipients and transporters can cancel their offer while it remains active. All packages containing that offer are excluded; the remaining packages are re-ranked and the request returns to `packages_ready` (`cancelled` only if no alternatives remain). A response timeout withdraws the non-responding party's offer under the same request lock. When the producer selects another package, competing recipients and transporters are notified that the producer is negotiating with someone else. The producer can also withdraw its selection without removing either offer.

Request states: `draft`, `awaiting_recipients`, `awaiting_transporters`, `packages_ready`, `in_agreement`, `confirmed`, `cancelled` (publication opens the recipient phase immediately, so "published" and "awaiting recipients" are the same state). Allowed transitions live in [`pickupFlow.js`](server/src/config/pickupFlow.js) and are enforced by [`pickupStateMachine.js`](server/src/services/pickupStateMachine.js); every change is stored in `pickup_status_history`.

Each role only receives its own data (see [`pickupViews.js`](server/src/services/pickupViews.js)): recipients never see transport prices and transporters never see treatment prices.

### Pickup user experience

- Creation has four sections: waste, pickup, attachments/options, review. Quantity is entered by the producer and its unit is kg or liters. Required fields are validated before advancing.
- A server-side draft can be saved once CER (or assistance), positive quantity, address and
  deadline are provided. Draft details offer editing; editing a published or completed request
  creates a new draft version, retains the old request and its status history, and restarts matching.
  Create, repeat and edit operations use idempotency keys to prevent duplicate requests.
  Leaving an edited form or reloading warns about unsaved changes. There is no automatic saving.
- Details explain the next actor and action. The producer's "requests you can act on" count
  includes publishable drafts, selectable packages, unanswered date proposals and optional
  early collection closure; it excludes agreements already accepted by the producer.
- Early phase closure, date counterproposals and offer cancellation explain their consequences
  before confirmation.
- Notifications distinguish loading, failure/retry and empty results. "Open request" goes to
  `/producer/pickups/:id`, `/recipient/pickups/:id` or `/transporter/pickups/:id`.
  These pages use the existing server-side ownership/invitation checks, including for closed requests.
- Recipient/transporter opportunities have status and text filters, with forms in pickup details.
  Mobile navigation is collapsed and keyboard operable; notifications and logout have accessible names.
- Transporter proposals are entered separately for each available recipient location. Each location
  supports a fixed trip price or a €/km rate calculated against a cached road distance.
- When the transporter phase opens, the server calculates road distances in batches from the
  producer and recipient coordinates already stored on the request. Distances are saved on
  `recipient_availabilities` and are not recalculated while viewing lists or details. The map shows
  only the producer and available recipient locations; it does not geocode addresses.
- Package ranking uses only total price. Treatment and per-km transport totals are shown before submission. VAT/extras are not
  separately calculated; agreed amounts are not presented as invoices or received payments.
- Liter pricing is recorded directly per liter; no density conversion is performed. The
  optional estimate endpoint is kg-only because it cannot estimate liters without verified density.
  General CER pricing/capacity settings remain
  unavailable: the page explains this and their endpoints return HTTP 501 rather than false success.
- Google Places autocomplete is configured through `VITE_GOOGLE_MAPS_API_KEY`. Without a key,
  the address field remains usable as text, but coordinates and `place_id` are not populated.
  Existing plain-text addresses are retained as formatted addresses; they are not geocoded
  automatically and need to be reselected from Places after configuring the key.
- Configure `GOOGLE_MAPS_API_KEY` in `server/.env` with Routes API enabled to calculate road
  distances, and `VITE_GOOGLE_MAPS_API_KEY` in `client/.env` with Maps JavaScript API enabled for
  the transporter map. Restrict each key to its required API and environment. Without the server
  key or saved coordinates, fixed-price offers remain available but €/km offers are disabled.
- Request photos are resized/compressed in the browser, stored as files (not DB blobs), and served
  through authenticated lazy-loaded references. Docker stores them in the persistent
  `pickup_uploads` volume (`UPLOAD_DIR`).

Manual verification:

1. As producer, start a request with empty fields: continue must highlight the missing CER/quantity.
   Complete the waste and pickup sections, save a draft, reload, edit it and save again:
   a draft keeps its ID; editing a published/terminal request creates one new draft and keeps the
   old request and history.
2. Publish; follow recipient and transporter notification links using their respective accounts.
   Submit availability and a separate fixed or €/km offer for each recipient location. With both
   Google keys configured and saved coordinates, check the map and road-distance totals. Without
   the Routes API key, fixed offers should remain usable and €/km should explain why it is disabled.
3. As producer, compare packages. After selecting and proposing a date, the next-step text must identify the other two parties,
   and the request must no longer appear in the producer's action filter.
4. Counterpropose: the warning must explain acceptance reset. Accept the same date with all three
   accounts and check confirmation. On another request, reject and verify remaining packages or
   cancellation if none remain. Cancelling a confirmation dialog must not change the request.
5. Check notification failure/retry separately from "no notifications", opportunity filters and
   collapsed navigation at mobile width. Capacity settings must not offer a fake save.

## Tests

```bash
cd server
npm test
```

Runs the whole flow (including refusal and timeout) against PostgreSQL in a temporary schema that is dropped at the end.
It also verifies the versioned schema migration and repeated migration runs.

The API runs versioned migrations before accepting requests. To apply migrations manually, use
`npm run migrate` from `server`; to roll back the latest migration use `npm run migrate -- down`.
Legacy ton quantities and recipient prices are converted to kg and per-kg values. Rollback stops
without changing the database if liter requests exist or a request has multiple photos, because the
previous schema cannot represent those values without guessing.

Frontend pure validation/guidance/filter tests (no extra test dependencies):

```bash
cd client
npm test
npm run build
```

## Environment Files

### Temporary automatic operator approval

`AUTO_APPROVE_OPERATORS` defaults to `false` (manual approval). Set it to `true` in
`server/.env` and restart the API to enable the temporary test mode:

- Existing producer, recipient and transporter accounts are verified at startup;
  their pending or rejected documents are approved without assigning a human reviewer.
- Newly registered operators and uploaded/replaced documents are automatically approved.
- Recipients and transporters can receive pickup invitations even without mandatory documents.
- Roles, authentication and access to other users' data remain unchanged. No admin account is created.

This mode is not suitable for production compliance checks. Set the flag back to `false`
and restart to restore manual approval and mandatory-document eligibility. Previously
auto-approved accounts/documents remain approved; review them explicitly if necessary.

Copy examples and customize:

- `client/.env.example` -> `client/.env`
- `server/.env.example` -> `server/.env`

Set `VITE_GOOGLE_MAPS_API_KEY` in `client/.env` and enable Places API for address suggestions.

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

## SiteGround / single-service production deployment

The repository root contains the deployment `package.json`. Connect the repository
and select the branch containing it; do not upload only `client/dist`.

- Runtime: Node.js 22.3+ (a supported LTS release is recommended).
- Package manager: npm. The root install hook installs the locked backend
  dependencies and the frontend build dependencies.
- Build command: `npm run build`.
- Start command: `npm start`.
- Run the Node.js application, not a static-only deployment of `client/dist`:
  Express serves the API, compiled frontend and React Router deep links on the
  same port. Leave the platform-provided `PORT` unchanged.
- Set `NODE_ENV=production` and `CLIENT_URL` to the exact public HTTPS origin
  (without a trailing slash).
- Create a PostgreSQL database and configure `DB_HOST`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, and `DB_PASSWORD` using the hosting provider's connection details.
  Startup applies schema changes; back up an existing database before deploying.
- Configure a strong `JWT_SECRET`, `GOOGLE_MAPS_API_KEY` (server Routes API key),
  and `VITE_GOOGLE_MAPS_API_KEY` (browser key restricted to the public domain).
  `VITE_*` values are public and are embedded during the build; never use them
  for server secrets.
- Leave `VITE_API_URL` and `VITE_SOCKET_URL` unset for same-origin requests.
  Do not copy their localhost values from local development.
- Keep `AUTO_APPROVE_OPERATORS=false` in production.
- Set `UPLOAD_DIR` to an absolute, persistent, writable directory outside
  replaceable deployment builds. Back it up along with the database and verify
  persistence across redeployments before accepting real uploads.

Configure environment variables in Site Tools, not in committed `.env` files.
Check the deployment logs and `/api/health`, then test login, a direct detail URL,
photo uploads and real-time notifications. WebSocket forwarding and persistent
storage must be verified on the chosen hosting plan.

Local deployment smoke test (builds the frontend and tests HTTP serving without
starting the database):

```bash
npm run test:deployment
```

Local development remains unchanged: run the client and server dev commands in
their respective directories.

## API Overview

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Producer (`/api/producers`)
  - `POST /pricing/estimate` (`quantity`, `quantityUnit`, `distanceKm`; estimate supports kg only)
  - `GET|POST /pickups`, `GET|PATCH /pickups/:id` (PATCH creates a new version after publication)
  - `GET|POST /sites`, `DELETE /sites/:siteId`
  - `POST /pickups/:id/repeat` (requires `Idempotency-Key`)
  - `POST /pickups/:id/photos` and authenticated `GET /api/pickups/:id/photos/:photoId`
  - `POST /pickups/:id/publish`
  - `POST /pickups/:id/close-recipients`, `POST /pickups/:id/close-transporters`
  - `POST /pickups/:id/packages/:packageId/select`
  - `POST /pickups/:id/withdraw-selection`, `POST /pickups/:id/cancel`
- Recipient (`/api/recipients`)
  - `GET /pickups`, `GET /pickups/:id`
  - `POST /pickups/:id/availability` (`{ available, unitPrice, quantityUnit?, destinationAddress, notes? }`)
  - `POST /pricing`, `POST /capacity` (placeholders)
- Transporter (`/api/transporters`)
  - `GET /pickups`, `GET /pickups/:id`
  - `POST /pickups/:id/proposal` (`{ price, vehicleType?, availabilityNote? }` or `{ decline: true }`)
  - `GET /earnings`
- Agreement on day/time, all three roles (`/api/pickups`)
  - `POST /:id/slots` (`{ scheduledAt }`: proposal or counter-proposal)
  - `POST /:id/slots/:slotId/accept`
  - `POST /:id/cancel-offer` (recipient / transporter withdraw their offer; remaining packages are re-ranked)
  - `POST /:id/completion-confirmations` (each selected party confirms their work is finished; status becomes `completed` after all three confirm)
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
