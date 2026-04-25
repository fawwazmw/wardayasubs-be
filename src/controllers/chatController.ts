import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { processTextMessage, processImageMessage, ChatAction, ChatResult } from '../services/chatService';
import prisma from '../lib/prisma';

function sanitizeTitle(text: string): string {
  return text.replace(/<[^>]*>/g, '').slice(0, 100);
}

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

async function findSubscription(userId: string, name: string) {
  return prisma.subscription.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
    include: { category: true },
  });
}

// ===== Action Handlers =====

interface ActionResult {
  action: string;
  message: string;
  subscription?: any;
  payment?: any;
  category?: any;
  deletedName?: string;
}

async function executeSingleAction(userId: string, act: ChatAction): Promise<ActionResult | null> {
  if (!act.data && !['query', 'chat', 'clarify'].includes(act.action)) return null;

  switch (act.action) {
    case 'add_subscription': {
      if (!act.data?.name) return null;
      const categoryId = await resolveCategoryId(userId, act.data.categoryName);
      const existing = await findSubscription(userId, act.data.name);
      if (existing) {
        const updateData: any = {};
        if (act.data.amount) updateData.amount = act.data.amount;
        if (act.data.currency) updateData.currency = act.data.currency;
        if (act.data.billingCycle) updateData.billingCycle = act.data.billingCycle;
        if (categoryId) updateData.categoryId = categoryId;
        const subscription = await prisma.subscription.update({
          where: { id: existing.id }, data: updateData, include: { category: true },
        });
        return { action: 'update_subscription', message: act.message, subscription };
      }
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const subscription = await prisma.subscription.create({
        data: {
          name: act.data.name, amount: act.data.amount || 0,
          currency: act.data.currency || 'USD', billingCycle: act.data.billingCycle || 'monthly',
          nextBillingDate: nextMonth, isActive: true, reminderDays: 3, categoryId, userId,
        },
        include: { category: true },
      });
      return { action: 'add_subscription', message: act.message, subscription };
    }

    case 'update_subscription': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}".` };
      const categoryId = await resolveCategoryId(userId, act.data.categoryName);
      const updateData: any = {};
      if (act.data.amount) updateData.amount = act.data.amount;
      if (act.data.currency) updateData.currency = act.data.currency;
      if (act.data.billingCycle) updateData.billingCycle = act.data.billingCycle;
      if (categoryId) updateData.categoryId = categoryId;
      const subscription = await prisma.subscription.update({
        where: { id: sub.id }, data: updateData, include: { category: true },
      });
      return { action: 'update_subscription', message: act.message, subscription };
    }

    case 'delete_subscription': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}".` };
      await prisma.subscription.delete({ where: { id: sub.id } });
      return { action: 'delete_subscription', message: act.message, deletedName: sub.name };
    }

    case 'toggle_subscription': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}".` };
      const isActive = act.data.isActive ?? !sub.isActive;
      const subscription = await prisma.subscription.update({
        where: { id: sub.id }, data: { isActive }, include: { category: true },
      });
      return { action: 'toggle_subscription', message: act.message, subscription };
    }

    case 'record_payment': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}". Can only record payments for existing subscriptions.` };
      const amount = act.data.amount || sub.amount;
      const currency = act.data.currency || sub.currency;
      const paidAt = act.data.paidAt ? new Date(act.data.paidAt) : new Date();
      const payment = await prisma.payment.create({
        data: { amount, currency, paidAt, subscriptionId: sub.id },
        include: { subscription: { select: { id: true, name: true, currency: true } } },
      });
      return { action: 'record_payment', message: act.message, payment };
    }

    case 'create_category': {
      if (!act.data?.categoryName) return null;
      const existing = await prisma.category.findFirst({
        where: { userId, name: { equals: act.data.categoryName, mode: 'insensitive' } },
      });
      if (existing) return { action: 'chat', message: `Category "${existing.name}" already exists.` };
      const color = act.data.color && act.data.color.startsWith('#') ? act.data.color : '#8B5CF6';
      const category = await prisma.category.create({
        data: { name: act.data.categoryName, color, userId },
      });
      return { action: 'create_category', message: act.message, category };
    }

    case 'delete_category': {
      if (!act.data?.categoryName) return null;
      const cat = await prisma.category.findFirst({
        where: { userId, name: { equals: act.data.categoryName, mode: 'insensitive' } },
      });
      if (!cat) return { action: 'chat', message: `Couldn't find category "${act.data.categoryName}".` };
      await prisma.category.delete({ where: { id: cat.id } });
      return { action: 'delete_category', message: act.message, deletedName: cat.name };
    }

    case 'start_trial': {
      if (!act.data?.name) return null;
      const existing = await findSubscription(userId, act.data.name);
      if (existing) {
        return { action: 'chat', message: `Subscription "${existing.name}" already exists. Use update instead.` };
      }
      const trialEnd = act.data.trialEndsAt ? new Date(act.data.trialEndsAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const nextBilling = new Date(trialEnd);
      nextBilling.setDate(nextBilling.getDate() + 1);
      const subscription = await prisma.subscription.create({
        data: {
          name: act.data.name,
          amount: act.data.amount || 0,
          currency: act.data.currency || 'USD',
          billingCycle: act.data.billingCycle || 'monthly',
          nextBillingDate: nextBilling,
          isActive: true,
          isTrial: true,
          trialEndsAt: trialEnd,
          reminderDays: 3,
          userId,
        },
        include: { category: true },
      });
      return { action: 'start_trial', message: act.message, subscription };
    }

    case 'rate_subscription': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}".` };
      const rating = act.data.usageRating;
      if (!rating || rating < 1 || rating > 5) {
        return { action: 'chat', message: 'Usage rating must be between 1 and 5.' };
      }
      const subscription = await prisma.subscription.update({
        where: { id: sub.id },
        data: { usageRating: rating },
        include: { category: true },
      });
      return { action: 'rate_subscription', message: act.message, subscription };
    }

    case 'share_subscription': {
      if (!act.data?.name) return null;
      const sub = await findSubscription(userId, act.data.name);
      if (!sub) return { action: 'chat', message: `Couldn't find subscription "${act.data.name}".` };
      const totalMembers = act.data.totalMembers || 2;
      const userShare = Math.round((sub.amount / totalMembers) * 100) / 100;
      const subscription = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          isShared: true,
          totalMembers,
          userShare,
        },
        include: { category: true },
      });
      return { action: 'share_subscription', message: act.message, subscription };
    }

    default:
      return null;
  }
}

async function handleResult(userId: string, result: ChatResult, res: Response): Promise<boolean> {
  try {
    // Multi-action array
    if (Array.isArray(result)) {
      const results: ActionResult[] = [];
      for (const act of result) {
        const r = await executeSingleAction(userId, act);
        if (r) results.push(r);
      }
      if (results.length > 0) {
        res.json({ actions: results, message: results.map(r => r.message).join('\n') });
        return true;
      }
      return false;
    }

    // Single action
    const r = await executeSingleAction(userId, result);
    if (r) {
      res.json(r);
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`Failed to handle action:`, err.message);
    res.json({ action: 'chat', message: 'Something went wrong. Please try again or do it manually.' });
    return true;
  }
}

// ===== Session CRUD =====

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user!.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load sessions' });
  }
};

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.create({
      data: { title: sanitizeTitle(req.body.title || 'New Chat'), userId: req.user!.userId },
    });
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create session' });
  }
};

export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load session' });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    await prisma.chatSession.delete({ where: { id: session.id } });
    res.json({ message: 'Session deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
};

// ===== Chat Messages =====

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const result = await processTextMessage(userId, sessionId, message.trim());
    const handled = await handleResult(userId, result, res);
    if (!handled) {
      // Single non-actionable result (query, chat, clarify)
      const single = Array.isArray(result) ? result[0] : result;
      res.json(single);
    }
  } catch (err: any) {
    console.error('Chat message error:', err.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

export const sendImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const file = req.file;
    const { message } = req.body;

    if (!file) { res.status(400).json({ error: 'Image file is required' }); return; }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ error: 'Unsupported image format.' }); return;
    }

    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const result = await processImageMessage(userId, sessionId, file.buffer, file.mimetype, message);
    const handled = await handleResult(userId, result, res);
    if (!handled) {
      const single = Array.isArray(result) ? result[0] : result;
      res.json(single);
    }
  } catch (err: any) {
    console.error('Chat image error:', err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
};
