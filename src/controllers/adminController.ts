import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// Middleware to check if user is admin
export const requireAdmin = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/admin/stats
export const getSystemStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalSubscriptions,
      totalCategories,
      totalPayments,
      activeSubscriptions,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count(),
      prisma.category.count(),
      prisma.payment.count(),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
      }),
    ]);

    // Calculate total subscription value
    const allSubs = await prisma.subscription.findMany({
      where: { isActive: true },
      select: { amount: true, billingCycle: true },
    });

    const monthlyRevenue = allSubs.reduce((total, sub) => {
      let monthlyAmount = sub.amount;
      switch (sub.billingCycle) {
        case 'weekly':
          monthlyAmount = sub.amount * 4.33;
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

    res.json({
      totalUsers,
      totalSubscriptions,
      totalCategories,
      totalPayments,
      activeSubscriptions,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      recentUsers,
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/admin/users
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (parseInt(page as string) - 1) * limitNum;

    const where = search
      ? {
          OR: [
            { email: { contains: search as string, mode: 'insensitive' as any } },
            { name: { contains: search as string, mode: 'insensitive' as any } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          currency: true,
          emailVerified: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: {
              subscriptions: true,
              categories: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page as string),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'Invalid user ID format' });
      return;
    }

    if (id === currentUserId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
