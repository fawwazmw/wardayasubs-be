import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { configurePassport } from './config/passport';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import subscriptionRoutes from './routes/subscriptions';
import categoryRoutes from './routes/categories';
import paymentRoutes from './routes/payments';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import chatRoutes from './routes/chat';

// Load environment variables
dotenv.config();

const app: Application = express();

// Trust proxy (needed behind Cloudflare tunnel / nginx / load balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — support multiple origins via comma-separated FRONTEND_URL or env
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim()),
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin === o || origin.endsWith(o.replace('https://', '.').replace('http://', '.')))) {
      return callback(null, true);
    }
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport
app.use(passport.initialize());
configurePassport();

// Global rate limiter for all API routes
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', globalLimiter);
}

// Swagger API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Wardaya Subs API Docs',
}));

app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Wardaya Subs API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

export default app;
