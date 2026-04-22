import { Router } from 'express';
import passport from 'passport';
import { register, login, getProfile, updateProfile, forgotPassword, resetPassword, verifyEmail, resendVerification, googleCallback } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }) as any);
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }) as any, googleCallback);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

export default router;
