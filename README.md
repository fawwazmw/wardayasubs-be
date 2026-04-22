# Backend - Wardaya Subs

Express.js + TypeScript + Prisma + PostgreSQL

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run database migrations:
```bash
npm run prisma:migrate
```

4. (Optional) Seed the database with demo data:
```bash
npm run prisma:seed
```

5. Start development server:
```bash
npm run dev
```

## API Documentation

Interactive Swagger UI is available at **http://localhost:3001/api-docs** when the server is running.

Raw OpenAPI spec: `GET /api-docs.json`

## API Endpoints

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | - | Health check |

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | - | Register new user |
| POST | `/api/auth/login` | - | Login (returns JWT) |
| POST | `/api/auth/verify-email` | - | Verify email with token |
| POST | `/api/auth/resend-verification` | - | Resend verification email |
| POST | `/api/auth/forgot-password` | - | Request password reset |
| POST | `/api/auth/reset-password` | - | Reset password with token |
| GET | `/api/auth/google` | - | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | - | Google OAuth callback |
| GET | `/api/auth/profile` | JWT | Get current user profile |
| PUT | `/api/auth/profile` | JWT | Update profile / change password |

### Subscriptions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/subscriptions` | JWT | Create subscription |
| GET | `/api/subscriptions` | JWT | List subscriptions (filter: `isActive`, `categoryId`) |
| GET | `/api/subscriptions/stats` | JWT | Get analytics/statistics |
| GET | `/api/subscriptions/upcoming` | JWT | Upcoming renewals (query: `days`) |
| GET | `/api/subscriptions/:id` | JWT | Get single subscription |
| PUT | `/api/subscriptions/:id` | JWT | Update subscription |
| DELETE | `/api/subscriptions/:id` | JWT | Delete subscription |
| POST | `/api/subscriptions/bulk-delete` | JWT | Delete multiple subscriptions |
| POST | `/api/subscriptions/import` | JWT | Import from CSV data |
| GET | `/api/subscriptions/export-all` | JWT | Export all user data |
| POST | `/api/subscriptions/import-all` | JWT | Import full data backup |

### Categories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/categories` | JWT | Create category |
| GET | `/api/categories` | JWT | List categories (with subscription count) |
| GET | `/api/categories/:id` | JWT | Get category with subscriptions |
| PUT | `/api/categories/:id` | JWT | Update category |
| DELETE | `/api/categories/:id` | JWT | Delete category |

### Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments` | JWT | List payments (filter: `subscriptionId`) |
| POST | `/api/payments` | JWT | Record a payment |
| DELETE | `/api/payments/:id` | JWT | Delete payment |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | JWT | List notifications (max 50) |
| PUT | `/api/notifications/:id/read` | JWT | Mark notification as read |
| PUT | `/api/notifications/read-all` | JWT | Mark all as read |

### Admin (requires `isAdmin: true`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | JWT + Admin | System-wide statistics |
| GET | `/api/admin/users` | JWT + Admin | List users (paginated, searchable) |
| DELETE | `/api/admin/users/:id` | JWT + Admin | Delete a user |

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 5 failed attempts | 15 min |
| `POST /api/auth/register` | 5 requests | 15 min |
| `POST /api/auth/forgot-password` | 5 requests | 15 min |
| `POST /api/auth/reset-password` | 5 requests | 15 min |
| `POST /api/auth/resend-verification` | 5 requests | 15 min |
| All `/api/*` routes | 100 requests | 15 min |

## Database Schema

See `prisma/schema.prisma` for the complete database schema (6 models: User, Subscription, Category, Payment, Notification, EmailVerification, PasswordReset).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server (from `dist/`) |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations (development) |
| `npm run prisma:migrate:deploy` | Run migrations (production) |
| `npm run prisma:seed` | Seed database with demo data |
| `npm run prisma:studio` | Open Prisma Studio GUI |

## Security

- JWT Bearer authentication
- Google OAuth 2.0
- Helmet security headers
- Rate limiting on auth and API routes
- Global error handler (hides stack traces in production)
- Zod request validation
- bcrypt password hashing (10 salt rounds)
