import { Router } from 'express';
import passport from 'passport';
import { register, login, getProfile, updateProfile, forgotPassword, resetPassword, verifyEmail, resendVerification, googleCallback } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { loginLimiter, authLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *                 minLength: 2
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       201:
 *         description: Account created, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 verifyToken:
 *                   type: string
 *                   description: Only returned in development mode
 *       400:
 *         description: Validation error or user already exists
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials or OAuth-only account
 *       403:
 *         description: Email not verified (code EMAIL_NOT_VERIFIED)
 */
router.post('/login', loginLimiter, login);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent (always returns success to prevent enumeration)
 */
router.post('/resend-verification', authLimiter, resendVerification);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent (always returns success to prevent enumeration)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 resetToken:
 *                   type: string
 *                   description: Only returned in development mode
 */
router.post('/forgot-password', authLimiter, forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid, expired, or already used token
 */
router.post('/reset-password', authLimiter, resetPassword);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Auth]
 *     description: Redirects to Google consent screen. Not callable from Swagger UI directly.
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }) as any);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Auth]
 *     description: Handles Google OAuth callback. Redirects to frontend with JWT token or error.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: OAuth authorization code (provided by Google)
 *     responses:
 *       302:
 *         description: Redirects to frontend with token or error query param
 */
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }) as any, googleCallback);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/profile', authenticate, getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               currency:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *                 description: Required when changing password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Requires currentPassword
 *               notifyRenewalReminders:
 *                 type: boolean
 *               notifyEmailReminders:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or wrong current password
 *       401:
 *         description: Not authenticated
 */
router.put('/profile', authenticate, updateProfile);

export default router;
