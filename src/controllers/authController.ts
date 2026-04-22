import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/email';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  currency: z.string().optional().default('USD'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
  notifyRenewalReminders: z.boolean().optional(),
  notifyEmailReminders: z.boolean().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, { message: 'Current password is required to set a new password' });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user (emailVerified defaults to false)
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        currency: validatedData.currency,
      },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        createdAt: true,
      },
    });

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: { token: verifyToken, userId: user.id, expiresAt },
    });

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`;
    await sendVerificationEmail(validatedData.email, verifyUrl);

    res.status(201).json({
      message: 'Account created. Please check your email to verify your account.',
      verifyToken: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.password) {
      res.status(401).json({ error: 'Please sign in with Google' });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(
      validatedData.password,
      user.password
    );

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check email verification
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Please verify your email before logging in', code: 'EMAIL_NOT_VERIFIED' });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        isAdmin: true,
        googleId: true,
        avatar: true,
        notifyRenewalReminders: true,
        notifyEmailReminders: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const validatedData = updateProfileSchema.parse(req.body);

    // If changing password, verify current password
    if (validatedData.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!user.password) {
        res.status(400).json({ error: 'Cannot set password for OAuth-only accounts' });
        return;
      }

      const isValid = await comparePassword(validatedData.currentPassword!, user.password);
      if (!isValid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const updateData: any = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.currency) updateData.currency = validatedData.currency;
    if (validatedData.newPassword) updateData.password = await hashPassword(validatedData.newPassword);
    if (validatedData.notifyRenewalReminders !== undefined) updateData.notifyRenewalReminders = validatedData.notifyRenewalReminders;
    if (validatedData.notifyEmailReminders !== undefined) updateData.notifyEmailReminders = validatedData.notifyEmailReminders;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        isAdmin: true,
        googleId: true,
        avatar: true,
        notifyRenewalReminders: true,
        notifyEmailReminders: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account with that email exists, a reset link has been generated.' });
      return;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    // Send email (falls back to console.log if SMTP not configured)
    await sendPasswordResetEmail(email, resetUrl);

    res.json({ message: 'If an account with that email exists, a reset link has been sent.', resetToken: process.env.NODE_ENV === 'development' ? token : undefined });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).parse(req.body);

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Hash new password and update user
    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const record = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    // Mark user as verified
    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    // Mark token as used
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { used: true },
    });

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent enumeration
    if (!user || user.emailVerified) {
      res.json({ message: 'If the account exists and is unverified, a new verification email has been sent.' });
      return;
    }

    // Invalidate old tokens
    await prisma.emailVerification.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerification.create({
      data: { token, userId: user.id, expiresAt },
    });

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    res.json({ message: 'If the account exists and is unverified, a new verification email has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Google OAuth callback handler
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    if (!user) {
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
      return;
    }

    const token = generateToken({
      userId: user.userId,
      email: user.email,
    });

    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('[OAuth] Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=server_error`);
  }
};
