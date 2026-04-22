import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { processTextMessage, processImageMessage, ChatAction } from '../services/chatService';
import prisma from '../lib/prisma';

// ===== Helpers =====

async function resolveCategoryId(userId: string, categoryName?: string): Promise<string | undefined> {
  if (!categoryName) return undefined;
  const existing = await prisma.category.findFirst({
    where: { userId, name: { equals: categoryName, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name: categoryName, color: '#8B5CF6', userId },
  });
  return created.id;
}

async function findExistingSubscription(userId: string, name: string) {
  return prisma.subscription.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
    include: { category: true },
  });
}

async function handleSubscriptionAction(userId: string, result: ChatAction, res: Response): Promise<boolean> {
  if (!result.data) return false;
  if (result.action !== 'add_subscription' && result.action !== 'update_subscription') return false;

  try {
    const categoryId = await resolveCategoryId(userId, result.data.categoryName);
    const existing = await findExistingSubscription(userId, result.data.name);

    if (existing) {
      const updateData: any = {};
      if (result.data.amount) updateData.amount = result.data.amount;
      if (result.data.currency) updateData.currency = result.data.currency;
      if (result.data.billingCycle) updateData.billingCycle = result.data.billingCycle;
      if (categoryId) updateData.categoryId = categoryId;

      const subscription = await prisma.subscription.update({
        where: { id: existing.id },
        data: updateData,
        include: { category: true },
      });
      res.json({ action: 'update_subscription', message: result.message, subscription });
      return true;
    }

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const subscription = await prisma.subscription.create({
      data: {
        name: result.data.name,
        amount: result.data.amount,
        currency: result.data.currency || 'USD',
        billingCycle: result.data.billingCycle || 'monthly',
        nextBillingDate: nextMonth,
        isActive: true,
        reminderDays: 3,
        categoryId,
        userId,
      },
      include: { category: true },
    });
    res.json({ action: 'add_subscription', message: result.message, subscription });
    return true;
  } catch (err: any) {
    console.error('Failed to handle subscription from chat:', err.message);
    res.json({ action: 'chat', message: `Something went wrong: ${err.message}. Please try manually.` });
    return true;
  }
}

// ===== Session CRUD =====

/** GET /api/chat/sessions */
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user!.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    res.json(sessions);
  } catch (err: any) {
    console.error('Get sessions error:', err.message);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
};

/** POST /api/chat/sessions */
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.create({
      data: {
        title: req.body.title || 'New Chat',
        userId: req.user!.userId,
      },
    });
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Create session error:', err.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

/** GET /api/chat/sessions/:id */
export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (err: any) {
    console.error('Get session error:', err.message);
    res.status(500).json({ error: 'Failed to load session' });
  }
};

/** DELETE /api/chat/sessions/:id */
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await prisma.chatSession.delete({ where: { id: session.id } });
    res.json({ message: 'Session deleted' });
  } catch (err: any) {
    console.error('Delete session error:', err.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
};

// ===== Chat Messages =====

/** POST /api/chat/sessions/:id/message */
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Verify session ownership
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const result = await processTextMessage(userId, sessionId, message.trim());

    const handled = await handleSubscriptionAction(userId, result, res);
    if (handled) return;

    res.json(result);
  } catch (err: any) {
    console.error('Chat message error:', err.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

/** POST /api/chat/sessions/:id/image */
export const sendImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const file = req.file;
    const { message } = req.body;

    if (!file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.' });
      return;
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const result = await processImageMessage(userId, sessionId, file.buffer, file.mimetype, message);

    const handled = await handleSubscriptionAction(userId, result, res);
    if (handled) return;

    res.json(result);
  } catch (err: any) {
    console.error('Chat image error:', err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
};
