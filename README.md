# Wardaya Subs — Backend API

REST API for **Wardaya Subs**, a subscription tracking application with AI-powered chatbot, spending insights, and automated renewal reminders.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20, TypeScript 5.4 |
| Framework | Express 4.18 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.11 |
| Authentication | Passport.js (Google OAuth 2.0), JWT (jsonwebtoken) |
| Validation | Zod 3.22 |
| AI | Groq SDK (Llama 4 Scout) + Google Generative AI (Gemini 2.5 Flash) |
| Email | Nodemailer 8 (SMTP) |
| Scheduler | node-cron |
| API Docs | Swagger UI Express + swagger-jsdoc (OpenAPI 3.0) |
| Security | Helmet, bcrypt, express-rate-limit |
| File Upload | Multer (memory storage, 10 MB limit) |
| Testing | Vitest 4 + Supertest 7 |
| Deployment | AWS Lambda (Serverless Framework), Docker, Railway |

---

## Project Structure

```
backend/
├── prisma/
│   ├── migrations/          # Database migration history
│   ├── schema.prisma        # Database schema (8 models)
│   └── seed.ts              # Demo data seeder
├── src/
│   ├── __tests__/           # 8 test suites (86 tests)
│   │   ├── setup.ts         # Test environment setup
│   │   ├── helpers.ts       # Shared test utilities
│   │   ├── auth.test.ts
│   │   ├── subscriptions.test.ts
│   │   ├── subscriptions-extended.test.ts
│   │   ├── categories.test.ts
│   │   ├── payments.test.ts
│   │   ├── notifications.test.ts
│   │   ├── chat-sessions.test.ts
│   │   └── insights.test.ts
│   ├── config/
│   │   ├── passport.ts      # Google OAuth strategy
│   │   └── swagger.ts       # OpenAPI spec generation
│   ├── controllers/         # 8 route controllers
│   │   ├── adminController.ts
│   │   ├── authController.ts
│   │   ├── categoryController.ts
│   │   ├── chatController.ts
│   │   ├── insightsController.ts
│   │   ├── notificationController.ts
│   │   ├── paymentController.ts
│   │   └── subscriptionController.ts
│   ├── jobs/
│   │   └── scheduler.ts     # Daily cron jobs
│   ├── lib/
│   │   └── prisma.ts        # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.ts          # JWT authentication middleware
│   │   ├── errorHandler.ts  # Global error handler
│   │   └── rateLimiter.ts   # Rate limiting configuration
│   ├── routes/              # 8 route modules
│   │   ├── admin.ts
│   │   ├── auth.ts
│   │   ├── categories.ts
│   │   ├── chat.ts
│   │   ├── insights.ts
│   │   ├── notifications.ts
│   │   ├── payments.ts
│   │   └── subscriptions.ts
│   ├── services/
│   │   ├── chatService.ts   # AI chatbot (Groq + Gemini)
│   │   └── currencyService.ts
│   ├── types/
│   │   └── express.d.ts     # Express type augmentation
│   ├── utils/
│   │   ├── auth.ts          # JWT helpers
│   │   └── email.ts         # Email templates & sending
│   ├── app.ts               # Express app configuration
│   ├── index.ts             # Server entry point
│   └── lambda.ts            # AWS Lambda handler
├── Dockerfile               # Multi-stage Docker build
├── Procfile                 # Heroku/Railway process file
├── railway.json             # Railway deployment config
├── serverless.yml           # AWS Lambda deployment config
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test runner configuration
├── .env.example             # Environment variable template
├── .env.development         # Local development config
├── .env.production          # Production config
└── .env.test                # Test environment config
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL >= 16
- npm

### Installation

```bash
# Clone and navigate to backend
cd wardaya-subs/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.development

# Edit with your database credentials and API keys
# See "Environment Variables" section below
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (development)
npm run prisma:migrate

# Seed with demo data (optional)
npm run prisma:seed
```

### Start Development Server

```bash
npm run dev
# Server: http://localhost:3001
# Swagger: http://localhost:3001/api-docs
```

---

## Environment Variables

The app loads environment files based on `NODE_ENV`:

| NODE_ENV | File loaded |
|----------|------------|
| `development` | `.env.development` |
| `production` | `.env.production` |
| `test` | `.env.test` |

Falls back to `.env` if the environment-specific file is missing. Path resolution is relative to the project root.

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/wardaya_subs"

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173    # Comma-separated for multiple origins

# Authentication
JWT_SECRET="change-this-to-a-random-string"

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Email (SMTP) — leave empty to use console.log fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# AI Chatbot
AI_PROVIDER=groq                     # "groq" (recommended) or "gemini"
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key
```

---

## Database Schema

8 Prisma models backed by PostgreSQL:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│      User        │────<│  Subscription    │────<│    Payment       │
│                  │     │                  │     │                  │
│ id (uuid)        │     │ id (uuid)        │     │ id (uuid)        │
│ email (unique)   │     │ name             │     │ amount           │
│ password?        │     │ amount           │     │ currency         │
│ name             │     │ currency         │     │ paidAt           │
│ currency         │     │ billingCycle     │     │ subscriptionId   │
│ emailVerified    │     │ startDate        │     └──────────────────┘
│ isAdmin          │     │ nextBillingDate  │
│ googleId?        │     │ categoryId?      │     ┌──────────────────┐
│ avatar?          │     │ website?         │     │    Category      │
│ notifyRenewal    │     │ logo?            │     │                  │
│ notifyEmail      │     │ isActive         │     │ id (uuid)        │
└──────────────────┘     │ reminderDays     │     │ name             │
        │                │ notes?           │     │ color?           │
        │                │ isTrial          │     │ icon?            │
        │                │ trialEndsAt?     │     │ userId           │
        │                │ isShared         │     └──────────────────┘
        │                │ totalMembers     │            │
        │                │ userShare?       │────────────┘
        │                │ usageRating?     │
        │                └──────────────────┘
        │
        ├────<┌──────────────────┐
        │     │  Notification    │
        │     │                  │
        │     │ id, message      │
        │     │ type, read       │
        │     │ userId           │
        │     └──────────────────┘
        │
        ├────<┌──────────────────┐     ┌──────────────────┐
        │     │  ChatSession     │────<│  ChatMessage     │
        │     │                  │     │                  │
        │     │ id, title        │     │ id, role         │
        │     │ userId           │     │ content, action? │
        │     └──────────────────┘     │ sessionId        │
        │                              └──────────────────┘
        │
        ├────<┌──────────────────┐
        │     │EmailVerification │
        │     │                  │
        │     │ id, token        │
        │     │ userId, expiresAt│
        │     │ used             │
        │     └──────────────────┘
        │
        └────<┌──────────────────┐
              │  PasswordReset   │
              │                  │
              │ id, token        │
              │ userId, expiresAt│
              │ used             │
              └──────────────────┘
```

Key features in the Subscription model:
- **Free trial tracking** — `isTrial`, `trialEndsAt`
- **Subscription sharing** — `isShared`, `totalMembers`, `userShare` (auto-calculated split)
- **Value scoring** — `usageRating` (1-5 self-rated usage frequency)

---

## API Endpoints

**Base URL:** `http://localhost:3001`

43+ endpoints across 8 route groups. Interactive documentation at `/api-docs`.

### Health & Docs

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/api-docs` | — | Swagger UI |
| `GET` | `/api-docs.json` | — | Raw OpenAPI spec |

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `POST` | `/api/auth/register` | — | Register new user |
| `POST` | `/api/auth/login` | — | Login (returns JWT) |
| `POST` | `/api/auth/verify-email` | — | Verify email with token |
| `POST` | `/api/auth/resend-verification` | — | Resend verification email |
| `POST` | `/api/auth/forgot-password` | — | Request password reset |
| `POST` | `/api/auth/reset-password` | — | Reset password with token |
| `GET` | `/api/auth/google` | — | Initiate Google OAuth flow |
| `GET` | `/api/auth/google/callback` | — | Google OAuth callback |
| `GET` | `/api/auth/profile` | JWT | Get current user profile |
| `PUT` | `/api/auth/profile` | JWT | Update profile / change password |

### Subscriptions (`/api/subscriptions`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `POST` | `/api/subscriptions` | JWT | Create subscription |
| `GET` | `/api/subscriptions` | JWT | List subscriptions (filter: `isActive`, `categoryId`) |
| `GET` | `/api/subscriptions/stats` | JWT | Analytics & statistics |
| `GET` | `/api/subscriptions/upcoming` | JWT | Upcoming renewals (query: `days`) |
| `GET` | `/api/subscriptions/:id` | JWT | Get single subscription |
| `PUT` | `/api/subscriptions/:id` | JWT | Update subscription |
| `DELETE` | `/api/subscriptions/:id` | JWT | Delete subscription |
| `POST` | `/api/subscriptions/bulk-delete` | JWT | Delete multiple subscriptions |
| `POST` | `/api/subscriptions/import` | JWT | Import from CSV data |
| `GET` | `/api/subscriptions/export-all` | JWT | Export all user data (JSON) |
| `POST` | `/api/subscriptions/import-all` | JWT | Import full data backup |

### Categories (`/api/categories`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `POST` | `/api/categories` | JWT | Create category |
| `GET` | `/api/categories` | JWT | List categories (with subscription count) |
| `GET` | `/api/categories/:id` | JWT | Get category with subscriptions |
| `PUT` | `/api/categories/:id` | JWT | Update category |
| `DELETE` | `/api/categories/:id` | JWT | Delete category |

### Payments (`/api/payments`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/api/payments` | JWT | List payments (filter: `subscriptionId`) |
| `POST` | `/api/payments` | JWT | Record a payment |
| `DELETE` | `/api/payments/:id` | JWT | Delete payment |

### Notifications (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/api/notifications` | JWT | List notifications (max 50) |
| `PUT` | `/api/notifications/:id/read` | JWT | Mark notification as read |
| `PUT` | `/api/notifications/read-all` | JWT | Mark all as read |

### Admin (`/api/admin`) — requires `isAdmin: true`

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/api/admin/stats` | JWT + Admin | System-wide statistics |
| `GET` | `/api/admin/users` | JWT + Admin | List users (paginated, searchable) |
| `DELETE` | `/api/admin/users/:id` | JWT + Admin | Delete a user |

### Chat (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/api/chat/sessions` | JWT | List all chat sessions |
| `POST` | `/api/chat/sessions` | JWT | Create a new session |
| `GET` | `/api/chat/sessions/:id` | JWT | Get session with all messages |
| `DELETE` | `/api/chat/sessions/:id` | JWT | Delete a session |
| `POST` | `/api/chat/sessions/:id/message` | JWT | Send a text message |
| `POST` | `/api/chat/sessions/:id/image` | JWT | Upload image for AI analysis (multipart) |

### Insights (`/api/insights`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/api/insights/forecast` | JWT | Spending forecast (1, 3, 6, 12 months) |
| `GET` | `/api/insights/comparison` | JWT | Annual vs monthly cost comparison |
| `GET` | `/api/insights/score` | JWT | Subscription value scores + AI alternatives |
| `GET` | `/api/insights/currency` | JWT | Convert all amounts to a base currency (query: `base`) |

---

## Authentication

### JWT

- Tokens issued on login/register with **7-day expiry**
- Sent via `Authorization: Bearer <token>` header
- Passwords hashed with **bcrypt (10 salt rounds)**

### Google OAuth 2.0

- Passport.js strategy with `passport-google-oauth20`
- Flow: `GET /api/auth/google` → Google consent → `GET /api/auth/google/callback` → JWT issued
- Accounts linked by `googleId`; password is optional for OAuth users

---

## Rate Limiting

All rate limits use a 15-minute sliding window.

| Scope | Development | Production |
|-------|:-----------:|:----------:|
| Global (`/api/*`) | 1000 req/15min | 100 req/15min |
| Login (`POST /api/auth/login`) | 50 req/15min | 5 failed attempts/15min |
| Auth endpoints (register, forgot-password, resend-verification) | 50 req/15min | 5 req/15min |

Rate limiting is disabled entirely during tests (`NODE_ENV=test`).

---

## Security

| Measure | Details |
|---------|---------|
| Helmet | Security headers (CSP disabled for Swagger UI compatibility) |
| bcrypt | Password hashing with 10 salt rounds |
| JWT | 7-day token expiry |
| Trust proxy | Enabled (`app.set('trust proxy', 1)`) for reverse proxy / load balancer |
| CORS | Configurable allowed origins; permissive in development, strict in production |
| Zod | Request body/query validation on all mutation endpoints |
| Error handler | Global middleware; stack traces hidden in production |
| Process guards | `unhandledRejection` and `uncaughtException` handlers |

---

## Background Jobs (Cron)

A daily scheduler runs at **00:05** via `node-cron`. Jobs also execute once on server startup to catch up.

| Job | Description |
|-----|-------------|
| **Advance billing dates** | Finds active subscriptions with past-due `nextBillingDate` and advances them to the next future date based on billing cycle |
| **Generate renewal reminders** | Creates in-app notifications for subscriptions billing within `reminderDays`. Sends a consolidated email per user (respects `notifyRenewalReminders` and `notifyEmailReminders` preferences) |
| **Check trial expirations** | Notifies users whose free trials expire within 3 days with `trial_expiry` notifications |

---

## AI Chatbot

Dual-provider AI chatbot with database-persisted conversation sessions.

### Providers

| Provider | Model | Role |
|----------|-------|------|
| **Groq** | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary |
| **Gemini** | `gemini-2.5-flash` | Fallback |

Configured via `AI_PROVIDER` env var (`groq` or `gemini`). Conversation history limited to last 20 messages per session.

### Action Types

The chatbot responds with structured JSON actions that the backend executes against the database:

| Action | Description |
|--------|-------------|
| `add_subscription` | Create a new subscription |
| `update_subscription` | Modify an existing subscription |
| `delete_subscription` | Remove a subscription |
| `toggle_subscription` | Activate/deactivate a subscription |
| `record_payment` | Record a payment for a subscription |
| `create_category` | Create a new category |
| `delete_category` | Delete a category |
| `start_trial` | Add a subscription with trial tracking |
| `rate_subscription` | Set usage rating (1-5) on a subscription |
| `share_subscription` | Configure subscription sharing/splitting |
| `query` | Answer questions about user's data |
| `chat` | General conversation |

Multi-action support: the AI can return a JSON array to execute multiple actions in sequence (e.g., "create category Entertainment and add Netflix to it").

Image analysis: users can upload receipt/screenshot images for the AI to extract subscription or payment details (Gemini only for vision, 10 MB limit).

---

## Testing

**86 tests** across 8 test files using **Vitest** + **Supertest**.

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

| Test Suite | File | Tests |
|-----------|------|:-----:|
| Auth | `auth.test.ts` | 14 |
| Subscriptions | `subscriptions.test.ts` | 15 |
| Subscriptions (extended) | `subscriptions-extended.test.ts` | 9 |
| Categories | `categories.test.ts` | 8 |
| Payments | `payments.test.ts` | 5 |
| Notifications | `notifications.test.ts` | 5 |
| Chat Sessions | `chat-sessions.test.ts` | 14 |
| Insights | `insights.test.ts` | 16 |

Configuration (`vitest.config.ts`):
- Environment: `node`
- Test timeout: 15 seconds
- Sequential execution (no parallelism) — tests share a database
- Setup file: `src/__tests__/setup.ts`

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `NODE_ENV=development tsx watch src/index.ts` | Start dev server with hot reload |
| `start` | `NODE_ENV=production node dist/index.js` | Start production server |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `test` | `NODE_ENV=test vitest run` | Run all tests |
| `test:watch` | `NODE_ENV=test vitest` | Run tests in watch mode |
| `predeploy` | `npm run build && npx prisma generate` | Pre-deploy build hook |
| `deploy` | Copies `.env.production` → `.env`, runs `serverless deploy` | Deploy to AWS Lambda |
| `deploy:offline` | `npm run build && npx serverless offline` | Test Lambda locally |
| `prisma:generate` | `prisma generate` | Generate Prisma client |
| `prisma:migrate` | `prisma migrate dev` (with `.env.development`) | Run migrations (development) |
| `prisma:migrate:deploy` | `prisma migrate deploy` (with `.env.production`) | Run migrations (production) |
| `prisma:seed` | `NODE_ENV=development tsx prisma/seed.ts` | Seed database (development) |
| `prisma:seed:prod` | `NODE_ENV=production tsx prisma/seed.ts` | Seed database (production) |
| `prisma:studio` | `prisma studio` (with `.env.development`) | Open Prisma Studio GUI |
| `prisma:push` | `prisma db push` (with `.env.development`) | Push schema (development) |
| `prisma:push:prod` | `prisma db push` (with `.env.production`) | Push schema (production) |

---

## Seed Data

The seed script (`prisma/seed.ts`) creates demo data for development:

**Users:**

| Email | Password | Role |
|-------|----------|------|
| `demo@wardaya.com` | `demo1234` | User |
| `admin@wardaya.com` | `admin1234` | Admin |

**6 Categories:**

| Name | Color |
|------|-------|
| Entertainment | `#EF4444` |
| Productivity | `#3B82F6` |
| Gaming | `#8B5CF6` |
| Health & Fitness | `#10B981` |
| News & Reading | `#F59E0B` |
| Cloud & Storage | `#6366F1` |

**10 Subscriptions:** Netflix, Spotify, YouTube Premium, Notion, GitHub Pro, Xbox Game Pass, Headspace, The New York Times, iCloud+, Google One

**3 Notifications:** Two renewal reminders + a welcome message

---

## Deployment

### AWS Lambda (Serverless Framework)

```bash
# Deploy to AWS (ap-southeast-1)
npm run deploy
```

Configuration in `serverless.yml`:
- Runtime: `nodejs20.x`
- Memory: 512 MB
- Timeout: 30 seconds
- Handler: `dist/lambda.handler` (Express wrapped with `serverless-http`)
- `useDotenv: true` — loads `.env` for environment variables
- Packages only `dist/`, Prisma client, and schema

### Docker

```bash
# Build
docker build -t wardaya-subs-api .

# Run
docker run -p 3001:3001 --env-file .env.production wardaya-subs-api
```

Multi-stage Dockerfile:
1. **Builder stage** — installs all deps, generates Prisma client, compiles TypeScript
2. **Production stage** — installs production deps only, copies compiled output, exposes port 3001

### Railway

Configured via `railway.json`:
- Builder: Nixpacks
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/index.js`
- Health check: `/health`
- Restart policy: on failure (max 10 retries)

### Heroku

`Procfile` included:
```
web: npx prisma migrate deploy && node dist/index.js
```

---

## License

MIT
