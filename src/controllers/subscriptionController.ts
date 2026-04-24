import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

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
  isTrial: z.boolean().optional(),
  trialEndsAt: z.string().datetime().optional(),
  isShared: z.boolean().optional(),
  totalMembers: z.number().int().min(1).optional(),
  userShare: z.number().positive().optional(),
  usageRating: z.number().int().min(1).max(5).optional(),
});

const updateSubscriptionSchema = createSubscriptionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

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
        ...(validatedData.trialEndsAt && {
          trialEndsAt: new Date(validatedData.trialEndsAt),
        }),
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
        ...(validatedData.trialEndsAt && {
          trialEndsAt: new Date(validatedData.trialEndsAt),
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

export const bulkDeleteSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = bulkDeleteSchema.parse(req.body);

    // Verify all subscriptions belong to user
    const subscriptions = await prisma.subscription.findMany({
      where: {
        id: { in: validatedData.ids },
        userId,
      },
      select: { id: true },
    });

    if (subscriptions.length !== validatedData.ids.length) {
      res.status(403).json({ error: 'Some subscriptions do not belong to you' });
      return;
    }

    // Delete all subscriptions
    const result = await prisma.subscription.deleteMany({
      where: {
        id: { in: validatedData.ids },
        userId,
      },
    });

    res.json({ message: `Deleted ${result.count} subscription(s)`, count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Bulk delete subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const importSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { subscriptions } = z.object({
      subscriptions: z.array(z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        currency: z.string().default('USD'),
        billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
        nextBillingDate: z.string(),
        categoryName: z.string().optional(),
        isActive: z.boolean().default(true),
        notes: z.string().optional(),
      })),
    }).parse(req.body);

    const imported: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      try {
        // Find or create category if provided
        let categoryId: string | undefined;
        if (sub.categoryName) {
          let category = await prisma.category.findFirst({
            where: { userId, name: sub.categoryName },
          });
          
          if (!category) {
            category = await prisma.category.create({
              data: { userId, name: sub.categoryName },
            });
          }
          categoryId = category.id;
        }

        const created = await prisma.subscription.create({
          data: {
            userId,
            name: sub.name,
            amount: sub.amount,
            currency: sub.currency,
            billingCycle: sub.billingCycle,
            nextBillingDate: new Date(sub.nextBillingDate),
            categoryId,
            isActive: sub.isActive,
            notes: sub.notes,
          },
        });
        imported.push(created);
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${sub.name}): ${err.message}`);
      }
    }

    res.json({
      message: `Imported ${imported.length} subscription(s)`,
      imported: imported.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Import subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportAllData = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get all user data
    const [subscriptions, categories, payments] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId },
        include: { category: true },
      }),
      prisma.category.findMany({
        where: { userId },
      }),
      prisma.payment.findMany({
        where: {
          subscription: { userId },
        },
        include: {
          subscription: { select: { name: true } },
        },
      }),
    ]);

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      subscriptions: subscriptions.map(s => ({
        name: s.name,
        description: s.description,
        amount: s.amount,
        currency: s.currency,
        billingCycle: s.billingCycle,
        startDate: s.startDate,
        nextBillingDate: s.nextBillingDate,
        categoryName: s.category?.name,
        website: s.website,
        logo: s.logo,
        isActive: s.isActive,
        reminderDays: s.reminderDays,
        notes: s.notes,
      })),
      categories: categories.map(c => ({
        name: c.name,
        color: c.color,
        icon: c.icon,
      })),
      payments: payments.map(p => ({
        subscriptionName: p.subscription.name,
        amount: p.amount,
        currency: p.currency,
        paidAt: p.paidAt,
      })),
    };

    res.json(backup);
  } catch (error) {
    console.error('Export all data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const importAllData = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { subscriptions, categories } = z.object({
      version: z.string().optional(),
      exportedAt: z.string().optional(),
      subscriptions: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        amount: z.number(),
        currency: z.string(),
        billingCycle: z.string(),
        startDate: z.string().optional(),
        nextBillingDate: z.string(),
        categoryName: z.string().optional(),
        website: z.string().optional(),
        logo: z.string().optional(),
        isActive: z.boolean().optional(),
        reminderDays: z.number().optional(),
        notes: z.string().optional(),
      })),
      categories: z.array(z.object({
        name: z.string(),
        color: z.string().optional(),
        icon: z.string().optional(),
      })).optional(),
      payments: z.array(z.any()).optional(),
    }).parse(req.body);

    let importedSubs = 0;
    let importedCats = 0;
    const errors: string[] = [];

    // Import categories first
    const categoryMap: Record<string, string> = {};
    if (categories) {
      for (const cat of categories) {
        try {
          let category = await prisma.category.findFirst({
            where: { userId, name: cat.name },
          });
          
          if (!category) {
            category = await prisma.category.create({
              data: {
                userId,
                name: cat.name,
                color: cat.color,
                icon: cat.icon,
              },
            });
            importedCats++;
          }
          categoryMap[cat.name] = category.id;
        } catch (err: any) {
          errors.push(`Category ${cat.name}: ${err.message}`);
        }
      }
    }

    // Import subscriptions
    for (const sub of subscriptions) {
      try {
        const categoryId = sub.categoryName ? categoryMap[sub.categoryName] : undefined;
        
        await prisma.subscription.create({
          data: {
            userId,
            name: sub.name,
            description: sub.description,
            amount: sub.amount,
            currency: sub.currency,
            billingCycle: sub.billingCycle,
            startDate: sub.startDate ? new Date(sub.startDate) : new Date(),
            nextBillingDate: new Date(sub.nextBillingDate),
            categoryId,
            website: sub.website,
            logo: sub.logo,
            isActive: sub.isActive ?? true,
            reminderDays: sub.reminderDays ?? 3,
            notes: sub.notes,
          },
        });
        importedSubs++;
      } catch (err: any) {
        errors.push(`Subscription ${sub.name}: ${err.message}`);
      }
    }

    res.json({
      message: `Imported ${importedSubs} subscription(s) and ${importedCats} categor${importedCats === 1 ? 'y' : 'ies'}`,
      imported: { subscriptions: importedSubs, categories: importedCats },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Import all data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
