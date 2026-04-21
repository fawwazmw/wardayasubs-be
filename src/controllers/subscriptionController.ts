import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const prisma = new PrismaClient();

const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.string().datetime().optional(),
  nextBillingDate: z.string().datetime(),
  categoryId: z.string().uuid().optional(),
  website: z.string().url().optional(),
  logo: z.string().url().optional(),
  reminderDays: z.number().int().min(0).default(3),
  notes: z.string().optional(),
});

const updateSubscriptionSchema = createSubscriptionSchema.partial();

export const createSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = createSubscriptionSchema.parse(req.body);

    // Verify category belongs to user if provided
    if (validatedData.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: validatedData.categoryId,
          userId,
        },
      });

      if (!category) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
    }

    const subscription = await prisma.subscription.create({
      data: {
        ...validatedData,
        startDate: validatedData.startDate
          ? new Date(validatedData.startDate)
          : new Date(),
        nextBillingDate: new Date(validatedData.nextBillingDate),
        userId,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { isActive, categoryId } = req.query;

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(categoryId && { categoryId: categoryId as string }),
      },
      include: {
        category: true,
      },
      orderBy: {
        nextBillingDate: 'asc',
      },
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        category: true,
        payments: {
          orderBy: {
            paidAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = updateSubscriptionSchema.parse(req.body);

    // Verify subscription belongs to user
    const existingSubscription = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!existingSubscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // Verify category belongs to user if provided
    if (validatedData.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: validatedData.categoryId,
          userId,
        },
      });

      if (!category) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        ...validatedData,
        ...(validatedData.startDate && {
          startDate: new Date(validatedData.startDate),
        }),
        ...(validatedData.nextBillingDate && {
          nextBillingDate: new Date(validatedData.nextBillingDate),
        }),
      },
      include: {
        category: true,
      },
    });

    res.json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify subscription belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await prisma.subscription.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSubscriptionStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    // Calculate monthly cost (normalize all to monthly)
    const monthlyTotal = subscriptions.reduce((total, sub) => {
      let monthlyAmount = sub.amount;
      
      switch (sub.billingCycle) {
        case 'weekly':
          monthlyAmount = sub.amount * 4.33; // Average weeks per month
          break;
        case 'quarterly':
          monthlyAmount = sub.amount / 3;
          break;
        case 'yearly':
          monthlyAmount = sub.amount / 12;
          break;
      }
      
      return total + monthlyAmount;
    }, 0);

    const yearlyTotal = monthlyTotal * 12;

    // Get upcoming renewals (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingRenewals = subscriptions.filter(
      (sub) => sub.nextBillingDate <= thirtyDaysFromNow
    );

    // Group by category
    const byCategory = subscriptions.reduce((acc, sub) => {
      const categoryName = sub.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          count: 0,
          total: 0,
        };
      }
      acc[categoryName].count++;
      acc[categoryName].total += sub.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    res.json({
      totalSubscriptions: subscriptions.length,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      yearlyTotal: Math.round(yearlyTotal * 100) / 100,
      upcomingRenewals: upcomingRenewals.length,
      byCategory,
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUpcomingRenewals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
        nextBillingDate: {
          lte: targetDate,
        },
      },
      orderBy: {
        nextBillingDate: 'asc',
      },
    });

    const now = new Date();
    const upcomingWithDays = subscriptions.map((sub) => {
      const daysUntilBilling = Math.ceil(
        (sub.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        currency: sub.currency,
        nextBillingDate: sub.nextBillingDate,
        daysUntilBilling: Math.max(0, daysUntilBilling),
      };
    });

    res.json(upcomingWithDays);
  } catch (error) {
    console.error('Get upcoming renewals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
