import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

// Global API rate limiter
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// Auth limiter for register, forgot-password, resend-verification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
});
