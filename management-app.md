# 📦 Distributor & Salesman Order Management App — Production Spec v5

## 📖 Overview

This application is a modern, production-grade order-taking system built using **Next.js** for distributors and salesmen. Designed for real-world field usage in Pakistan, optimized for:

- Slow/unstable internet (2G/3G)
- Mobile-first workflows (salesmen primarily on phones)
- Non-technical users
- High reliability — zero data loss tolerance
- Duplicate-safe order submission (idempotency)

This is a **multi-tenant SaaS-ready architecture** where each distributor operates in full data isolation.

---

## 🎯 Objectives

- Simplify order collection for field salesmen
- Provide real-time order visibility to distributors
- Enforce strict tenant isolation at the API layer
- Ensure high performance at scale (10k+ orders)
- Prevent duplicate operations via idempotency
- Support offline-capable workflows (Phase 2)
- Evolve into a full SaaS platform (Phase 3+)

---

## 👥 User Roles

### 1. Salesman
- Login to system
- View only their assigned distributor's products
- Select customer (shop) before placing order
- Create and submit orders (cart persisted as DRAFT)
- Track personal order history

### 2. Distributor
- View orders from assigned salesmen only
- Approve or reject pending orders
- Manage product inventory
- View customer list

### 3. Admin
- Manage all users (salesmen & distributors)
- Assign salesmen to distributors
- View global analytics and order summary

---

## ⚙️ Core Features (MVP)

- Authentication (NextAuth.js — JWT strategy, bcrypt passwords)
- Product & Customer (Shop) management
- Order creation with cart persistence (DRAFT orders)
- Full order lifecycle with strict state machine
- Role-based dashboards
- Multi-tenant data isolation (API-enforced)
- Salesman ↔ Distributor assignment
- Idempotency on all mutation endpoints
- Role-based rate limiting

---

## 🚀 Advanced Features (Future Scope)

- Offline-first support — IndexedDB + service worker sync (Phase 2)
- Data archival — orders older than 6 months moved to archive table (Phase 2)
- Push notifications (Phase 3)
- GPS tracking for salesmen (Phase 3)
- Credit limits per customer (Phase 3)
- PDF invoice generation + file storage (Phase 3)
- Multi-language support — Urdu + English (Phase 3)
- Full-text search via PostgreSQL `tsvector` (Phase 3)
- Background job queue for async work — BullMQ / Upstash Queue (Phase 3, when needed)

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React Server Components, Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| Database | PostgreSQL (Neon / Supabase) |
| ORM | Prisma |
| Auth | NextAuth.js (JWT strategy) |
| Validation | Zod (all API inputs) |
| Rate Limiting | Upstash Ratelimit |
| Deployment | Vercel |

> **Not in Phase 1:** Cloudinary/S3 (file storage), BullMQ/Upstash Queue (job queue), PostgreSQL RLS. These are added only when the features that require them are built.

---

## 🏗️ System Architecture

```
Client (Mobile/Web — Salesman)
        ↓
Next.js Frontend (Mobile-first, RSC)
        ↓
middleware.ts  (Auth check + Rate limiting)
        ↓
API Routes /api/*  (Zod validation + Idempotency check)
        ↓
Prisma ORM  (Tenant-scoped queries)
        ↓
PostgreSQL (Neon/Supabase)
```

---

## 🔐 Multi-Tenant Data Isolation

Isolation is enforced at the **API layer** on every query. The `distributorId` is always read from the authenticated session — never trusted from the request body.

```ts
// Every distributor-scoped query must include this
where: {
  distributorId: session.user.distributorId
}
```

- Salesmen only see products and customers belonging to their assigned distributor
- Distributors only see orders placed by their assigned salesmen
- Admin role bypasses isolation for global views only
- Middleware enforces role + tenant on every `/api/*` route before the handler runs

> **Note on PostgreSQL RLS:** Row-Level Security is a valid future hardening option but is not compatible with Prisma's default superuser connection pool without significant extra setup (e.g., Supabase auth integration or raw query layer). For Phase 1, strict API-layer enforcement is sufficient and far simpler to implement and debug.

---

## 🔁 Idempotency (Critical for Reliability)

All mutation endpoints (`POST`, `PATCH`) must support idempotency to prevent duplicate orders on network retry.

### How it works

1. Client generates a unique `Idempotency-Key` (UUID) per request and sends it as a header
2. Server checks the `IdempotencyRecord` table for `(userId, key)`
3. If found → return the stored response immediately (no re-processing)
4. If not found → process the request, store `(userId, key, responseStatus, responseBody)`, return response
5. Records expire after **24 hours** (cleanup via scheduled job or DB TTL)

### Request header

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

### IdempotencyRecord table

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| key | String | The client-provided key |
| responseStatus | Int | HTTP status code stored |
| responseBody | JSON | Full response stored |
| createdAt | DateTime | |
| expiresAt | DateTime | createdAt + 24 hours |

> Index on `(userId, key)` for fast lookup. Unique constraint on `(userId, key)`.

---

## 🗄️ Database Schema

### Indexing Strategy

| Table | Index |
|---|---|
| Order | `(distributorId, status)` |
| Order | `(salesmanId)` |
| Order | `(customerId)` |
| Product | `(distributorId)` |
| Customer | `(distributorId)` |
| OrderItem | `(orderId)` |
| AuditLog | `(entityId, entityType)` |
| IdempotencyRecord | `(userId, key)` — unique |

---

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | |
| email | String | Unique |
| passwordHash | String | bcrypt, 12 salt rounds — never store plain text |
| role | Enum | `ADMIN`, `DISTRIBUTOR`, `SALESMAN` |
| distributorId | UUID? | FK → User (distributor) — required for SALESMAN role |
| tokenVersion | Int | Increments on forced logout / password change |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

---

### Customer (Shop)

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | Retail shop name |
| address | String | |
| phone | String? | |
| creditLimit | Decimal | Default 0 — enforced in Phase 3 |
| distributorId | UUID | FK → User (distributor) — tenant scope |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

---

### Product

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | |
| price | Decimal | Current listed price |
| stock | Int | Decrements on order APPROVAL only |
| distributorId | UUID | FK → User (distributor) — tenant scope |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

---

### Order

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| salesmanId | UUID | FK → User |
| distributorId | UUID | FK → User — tenant scope |
| customerId | UUID | FK → Customer — required, cannot be null |
| status | Enum | `DRAFT`, `PENDING`, `APPROVED`, `DELIVERED`, `CANCELLED` |
| notes | String? | Optional salesman notes |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete (cancellations) |
| updatedBy | UUID | FK → User — audit trail |

---

### OrderItem

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| orderId | UUID | FK → Order |
| productId | UUID | FK → Product |
| quantity | Int | |
| unitPrice | Decimal | Price snapshot at order time — never derived from current product price |

---

### AuditLog

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| userId | UUID | Who performed the action |
| action | String | e.g. `ORDER_APPROVED`, `STOCK_UPDATED`, `USER_CREATED` |
| entityType | String | e.g. `Order`, `Product`, `User` |
| entityId | UUID | The affected record |
| metadata | JSON? | Before/after values or extra context |
| createdAt | DateTime | |

---

## 🔄 Order State Machine (Strict)

```
DRAFT → PENDING → APPROVED → DELIVERED
                ↘ CANCELLED
```

### Transition Rules

| From | To | Who | Side Effect |
|---|---|---|---|
| DRAFT | PENDING | Salesman | Locks cart — no further edits |
| PENDING | APPROVED | Distributor | Stock decremented (atomic transaction) |
| PENDING | CANCELLED | Distributor | No stock change |
| APPROVED | DELIVERED | Distributor | Final state |
| APPROVED | CANCELLED | Admin only | Stock restored |
| DELIVERED | — | — | Terminal — no transitions |
| CANCELLED | — | — | Terminal — no transitions |

Invalid transitions must return `400` with error code `INVALID_TRANSITION`.

---

## 📦 Stock Decrement — Concurrency Safe

Stock decrements on **APPROVAL only**, inside a single Prisma transaction using a conditional `WHERE` to eliminate race conditions between concurrent approvals.

```ts
await prisma.$transaction(async (tx) => {
  for (const item of order.items) {
    // Conditional update — fails if stock is insufficient
    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        stock: { gte: item.quantity }   // atomically checks + decrements
      },
      data: {
        stock: { decrement: item.quantity }
      }
    });

    if (updated.count === 0) {
      throw new Error('OUT_OF_STOCK');
    }
  }

  await tx.order.update({
    where: { id: order.id },
    data: { status: 'APPROVED', updatedBy: session.user.id }
  });
});
```

> This pattern eliminates the SELECT → UPDATE race condition. If two distributors approve overlapping orders simultaneously, only one will succeed per item.

---

## 📡 API Contract

All routes require a valid session. Role requirements are noted per endpoint.
Unauthorized → `401`. Wrong role → `403`. Mutation routes require `Idempotency-Key` header.

---

### Orders

#### `POST /api/orders`
**Role:** Salesman

```json
Headers: { "Idempotency-Key": "uuid" }

Request:
{
  "customerId": "uuid",
  "items": [{ "productId": "uuid", "quantity": 2 }],
  "notes": "optional string"
}

Response 201:
{
  "id": "uuid",
  "status": "PENDING",
  "createdAt": "ISO8601"
}

Errors:
  400 OUT_OF_STOCK
  400 INVALID_INPUT
  404 NOT_FOUND
```

---

#### `GET /api/orders`
**Role:** Salesman (own), Distributor (assigned salesmen), Admin (all)

```
Query params:
  limit       (default 20, max 100)
  cursor      (UUID — cursor-based pagination)
  status      (DRAFT | PENDING | APPROVED | DELIVERED | CANCELLED)
  from        (ISO8601 date)
  to          (ISO8601 date)
  customerId  (UUID — filter by shop)

Response 200:
{
  "data": [ ...orders ],
  "nextCursor": "uuid | null"
}
```

---

#### `PATCH /api/orders/:id/status`
**Role:** Distributor (APPROVE / CANCEL / DELIVER), Salesman (CANCEL own DRAFT only)

```json
Headers: { "Idempotency-Key": "uuid" }

Request: { "status": "APPROVED | CANCELLED | DELIVERED" }

Response 200: { "id": "uuid", "status": "APPROVED" }

Errors:
  400 INVALID_TRANSITION
  400 OUT_OF_STOCK
  403 UNAUTHORIZED
  404 NOT_FOUND
```

---

### Products

#### `GET /api/products`
**Role:** Salesman, Distributor

```
Query params: limit, cursor, search (name ILIKE)

Response 200:
{
  "data": [{ "id", "name", "price", "stock" }],
  "nextCursor": "uuid | null"
}
```

#### `POST /api/products`
**Role:** Distributor

```json
Headers: { "Idempotency-Key": "uuid" }
Request:  { "name": "string", "price": 0.00, "stock": 0 }
Response 201: { "id": "uuid", "name": "string", "price": 0.00, "stock": 0 }
```

#### `PATCH /api/products/:id`
**Role:** Distributor

```json
Request:  { "price": 0.00, "stock": 0 }
Response 200: { "id": "uuid", "name": "string", "price": 0.00, "stock": 0 }
```

---

### Customers

#### `GET /api/customers`
**Role:** Salesman, Distributor

```
Query params: limit, cursor, search (name ILIKE)
```

#### `POST /api/customers`
**Role:** Distributor

```json
Headers: { "Idempotency-Key": "uuid" }
Request:  { "name": "string", "address": "string", "phone": "string?" }
Response 201: { "id": "uuid", "name": "string" }
```

---

### Standard Error Response

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Product 'Coca Cola 1L' has insufficient stock.",
    "field": "items[0].quantity"
  }
}
```

**Error codes:** `OUT_OF_STOCK`, `UNAUTHORIZED`, `INVALID_INPUT`, `INVALID_TRANSITION`, `NOT_FOUND`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`, `SERVER_ERROR`

---

## 📁 Project Structure

```
/app
  /login
  /dashboard
    /salesman
      /orders
      /products
      /new-order
    /distributor
      /orders
      /products
      /customers
    /admin
      /users
      /analytics

/api
  /auth
    /[...nextauth]
      /route.ts
  /orders
    /route.ts             ← GET (list), POST (create)
    /[id]
      /status
        /route.ts         ← PATCH (approve / cancel / deliver)
  /products
    /route.ts             ← GET (list), POST (create)
    /[id]
      /route.ts           ← PATCH (update price/stock)
  /customers
    /route.ts             ← GET (list), POST (create)

/lib
  /prisma.ts              ← Prisma client singleton
  /ratelimit.ts           ← Upstash config with role-based limits
  /auth.ts                ← NextAuth config + session helpers
  /validations.ts         ← Zod schemas for all API inputs
  /idempotency.ts         ← Idempotency check/store helpers

/middleware.ts            ← Auth guard + rate limiting (applied globally)

/prisma
  /schema.prisma
  /migrations/
  /seed.ts                ← Seeds admin user + demo distributor + test salesman

/components
  /ui                     ← Shared primitive components
  /forms                  ← Order form, product form, etc.
  /dashboard              ← Role-specific dashboard components
```

---

## 🔐 Security

- **Password hashing:** bcrypt, 12 salt rounds — never store plain text passwords
- **Sessions:** NextAuth JWT, 8-hour expiry
- **Forced logout:** `tokenVersion` field on User — increment to invalidate all existing tokens
- **Role enforcement:** Middleware validates role on every `/api/*` route before handler executes
- **Input validation:** Zod schemas on every API route — malformed requests rejected before hitting DB
- **Rate limiting:** Upstash Ratelimit, role-based limits (see below)
- **Tenant isolation:** `distributorId` always sourced from session — never from request body

### Rate Limits

| Role | Limit |
|---|---|
| Salesman | 60 req / min |
| Distributor | 120 req / min |
| Admin | 300 req / min |

---

## ⚙️ Environment Config

Create `.env.local` — never commit to git:

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Upstash Rate Limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

In production, add all variables to the **Vercel Environment Variables** dashboard — not `.env` files.

---

## 🗃️ Prisma Migration Strategy

```bash
# Development — creates migration file and applies it
npx prisma migrate dev --name init

# Production — applies pending migrations safely
npx prisma migrate deploy

# Seed initial data (admin user, demo distributor, test salesman)
npx prisma db seed

# Explore DB visually
npx prisma studio
```

**Rules:**
- Never run `migrate dev` on production
- Always run `migrate deploy` as part of the Vercel build step (`postbuild` script)
- Keep `seed.ts` idempotent — safe to run multiple times without creating duplicates

---

## ⚡ Performance

- React Server Components for product catalog — zero client JS
- Cursor-based pagination on all list APIs — no slow `OFFSET` queries
- All `WHERE` clauses hit indexed columns — no full table scans
- `next/cache` with tag-based revalidation for product data
- Minimal JS bundle — client components only where interactivity is required
- Skeleton loaders for slow network UX

---

## 🛡️ Reliability

- **Cart persistence:** Active cart saved as `DRAFT` order in DB — survives page refresh, network drop, app crash
- **Idempotency:** Duplicate order submissions on retry return the original response — no double orders
- **Retry UI:** Failed submissions show clear error state + retry button — no silent failures, no lost carts
- **Atomic stock updates:** Conditional `updateMany` + Prisma transaction eliminates race conditions
- **Soft deletes:** `deletedAt` on all entities — data is never permanently lost
- **Audit log:** Every state change recorded with userId, action, and timestamp

---

## 📱 Offline Strategy (Phase 2)

- Cart stored in **IndexedDB** when offline
- API requests queued via **service worker** background sync
- On reconnect: queued requests replayed in chronological order
- **Conflict resolution (server-wins):** If product is out of stock at sync time, server rejects and UI notifies the salesman to revise the cart before resubmitting
- Each queued request carries a pre-generated `Idempotency-Key` so replay is safe

---

## 📊 Search (Phase 1 Scope)

Phase 1 search uses indexed `ILIKE` queries — fast enough for typical distributor catalogue sizes (< 10k products).

**What is searchable in Phase 1:**
- Products: search by name (`GET /api/products?search=cola`)
- Customers: search by name (`GET /api/customers?search=ali`)
- Orders: filter by status and date range — no free-text search on orders in Phase 1

**Phase 3:** Migrate to PostgreSQL `tsvector` full-text search if catalogue grows beyond 50k rows.

---

## 🗂️ Data Archival (Phase 2)

- Orders older than 6 months moved to an `OrderArchive` table
- Active `orders` table stays lean for fast queries
- Archived orders remain readable via admin panel
- A scheduled job (cron via Vercel Cron or pg_cron) runs the migration monthly

---

## 🧪 Testing Strategy

| Type | Tool | What to cover |
|---|---|---|
| Unit | Jest | Zod validators, state machine transition rules, idempotency logic |
| Integration | Jest + Prisma test DB | Order approval + stock decrement, role-based access, idempotency key deduplication |
| E2E | Playwright | Salesman full order flow, distributor approval flow, cross-tenant isolation check |

Run integration tests against a **separate test database** — never against production or dev DB.

---

## 📊 Logging & Observability

- **Error logging:** Sentry for server-side exceptions with full request context
- **API errors:** All `5xx` responses logged with route, userId, and sanitised request body
- **Order events:** Key transitions (`ORDER_PLACED`, `ORDER_APPROVED`, `STOCK_DECREMENTED`) written to `AuditLog`
- **Slow queries:** Prisma query logging enabled in development (`log: ['query', 'warn', 'error']`)
- **Metrics to track:** Orders per day, failed approvals, API latency p95, error rate per route

---

## 🚀 Deployment Checklist (Pre-Launch)

- [ ] Run `npx prisma migrate deploy` on production DB
- [ ] Set all env vars on Vercel dashboard (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, Upstash keys)
- [ ] Run `npx prisma db seed` to create admin user and demo distributor
- [ ] Verify rate limiting is active — test with rapid requests, confirm `429` response
- [ ] Smoke test full order flow: salesman login → select customer → create order → distributor approve → verify stock decremented
- [ ] Smoke test idempotency: submit same order twice with same `Idempotency-Key` → confirm only one order created
- [ ] Verify cross-tenant isolation: salesman A cannot see distributor B's products or orders
- [ ] Check mobile layout on a real Android device (Chrome)
- [ ] Confirm `NEXTAUTH_URL` matches the production domain exactly
- [ ] Verify `deletedAt` soft delete works — delete a product and confirm it disappears from salesman view but remains in DB

---

## 🛠️ Development Roadmap

### Phase 1 — MVP (Weeks 1–4)
- [ ] Project setup + environment config + folder structure
- [ ] Prisma schema — all tables including IdempotencyRecord
- [ ] Seed script — admin, demo distributor, test salesman, sample products
- [ ] NextAuth setup — bcrypt + JWT + tokenVersion
- [ ] Middleware — auth guard + role-based rate limiting
- [ ] API routes — orders, products, customers with Zod validation + idempotency
- [ ] Salesman UI — mobile-first: product catalog, customer picker, cart, order history
- [ ] Cart persisted as DRAFT order in DB

### Phase 2 — Distributor & Hardening (Weeks 5–7)
- [ ] Distributor dashboard — order queue, approve/reject with atomic stock decrement
- [ ] Admin — user management, salesman ↔ distributor assignment
- [ ] Audit log implementation
- [ ] Pagination on all list views
- [ ] Basic admin analytics (daily order count, total value)
- [ ] Offline cart — IndexedDB + service worker sync with idempotency-safe replay
- [ ] Data archival job setup

### Phase 3 — Advanced Features (Weeks 8–12)
- [ ] Push notifications
- [ ] PDF invoice generation + file storage (Cloudinary / S3)
- [ ] GPS location tagging on order submission
- [ ] Urdu language support (i18n)
- [ ] Credit limit enforcement per customer
- [ ] Full-text search (PostgreSQL tsvector)
- [ ] Background job queue (BullMQ / Upstash Queue) for async invoice + notification work

---

## 🧠 Key Design Principles

- **Reliability over features** — a lost order is worse than a missing feature
- **Mobile-first always** — design for a salesman on a phone in a crowded shop
- **Snapshot prices** — `unitPrice` on OrderItem is immutable after creation
- **Soft-delete everything** — data recovery must always be possible
- **Server-wins on conflicts** — simpler than merge logic, correct for inventory
- **Idempotency by default** — all mutations are safe to retry
- **Tenant isolation at the query level** — `distributorId` from session, always
- **Add complexity only when needed** — queues, RLS, and file storage are added when the feature that requires them ships, not before
- **Build incrementally** — ship Phase 1 into real users' hands before writing Phase 3 code

---

## 📌 Conclusion

This is a **production-ready, scalable system design** built for real Pakistani distributor/salesman field workflows. The architecture is solid enough to evolve into a full multi-tenant SaaS platform without structural rewrites.

Key guarantees this spec provides:
- No duplicate orders (idempotency)
- No race conditions on stock (conditional atomic updates)
- No cross-tenant data leaks (session-enforced isolation)
- No data loss (soft deletes + DRAFT cart persistence)
- No launch-day surprises (deployment checklist)

Follow the roadmap phase by phase. Resist building Phase 3 before Phase 1 is stable and in real users' hands.