import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  paidAt: z.string().datetime().optional(),
  subscriptionId: z.string().uuid(),
});

// GET /api/payments - list all payments for the user (optionally filtered by subscriptionId)
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { subscriptionId } = req.query;

    if (subscriptionId && !isValidUUID(subscriptionId as string)) {
      res.status(400).json({ error: 'Invalid subscriptionId format' });
      return;
    }

    const payments = await prisma.payment.findMany({
      where: {
        subscription: { userId },
        ...(subscriptionId ? { subscriptionId: subscriptionId as string } : {}),
      },
      include: {
        subscription: {
          select: { id: true, name: true, currency: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/payments - record a new payment
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const validatedData = createPaymentSchema.parse(req.body);

    // Verify subscription belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: { id: validatedData.subscriptionId, userId },
    });

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        amount: validatedData.amount,
        currency: validatedData.currency,
        paidAt: validatedData.paidAt ? new Date(validatedData.paidAt) : new Date(),
        subscriptionId: validatedData.subscriptionId,
      },
      include: {
        subscription: {
          select: { id: true, name: true, currency: true },
        },
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/payments/:id
export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const payment = await prisma.payment.findFirst({
      where: { id },
      include: { subscription: { select: { userId: true } } },
    });

    if (!payment || payment.subscription.userId !== userId) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    await prisma.payment.delete({ where: { id } });
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
