import supertest from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { hashPassword, generateToken } from '../utils/auth';

export const request = supertest(app);

interface TestUserOptions {
  email?: string;
  name?: string;
  password?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  currency?: string;
}

/**
 * Create a test user in the database and return the user + JWT token.
 */
export async function createTestUser(options: TestUserOptions = {}) {
  const {
    email = `test-${Date.now()}@example.com`,
    name = 'Test User',
    password = 'password123',
    emailVerified = true,
    isAdmin = false,
    currency = 'USD',
  } = options;

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      emailVerified,
      isAdmin,
      currency,
    },
  });

  const token = generateToken({ userId: user.id, email: user.email });

  return { user, token, plainPassword: password };
}

/**
 * Create a test category for a user.
 */
export async function createTestCategory(userId: string, options: { name?: string; color?: string } = {}) {
  return prisma.category.create({
    data: {
      name: options.name || `Category-${Date.now()}`,
      color: options.color || '#3B82F6',
      userId,
    },
  });
}

/**
 * Create a test subscription for a user.
 */
export async function createTestSubscription(userId: string, options: {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: string;
  categoryId?: string;
  isActive?: boolean;
} = {}) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return prisma.subscription.create({
    data: {
      name: options.name || `Sub-${Date.now()}`,
      amount: options.amount || 9.99,
      currency: options.currency || 'USD',
      billingCycle: options.billingCycle || 'monthly',
      nextBillingDate: nextMonth,
      categoryId: options.categoryId,
      isActive: options.isActive ?? true,
      userId,
    },
    include: { category: true },
  });
}
