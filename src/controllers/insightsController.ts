import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { convertCurrency, getExchangeRates } from '../services/currencyService';

// ===== Helpers =====

function toMonthlyAmount(amount: number, billingCycle: string): number {
  switch (billingCycle) {
    case 'weekly':
      return amount * 4.33;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

// ===== GET /api/insights/forecast =====

export const getForecast = async (
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
      where: { userId, isActive: true },
    });

    const monthlyTotal = subscriptions.reduce((sum, sub) => {
      return sum + toMonthlyAmount(sub.amount, sub.billingCycle);
    }, 0);

    const round = (n: number) => Math.round(n * 100) / 100;

    // Build per-month breakdown for next 12 months
    const byMonth: { month: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.push({ month: monthStr, amount: round(monthlyTotal) });
    }

    res.json({
      monthly: round(monthlyTotal),
      threeMonth: round(monthlyTotal * 3),
      sixMonth: round(monthlyTotal * 6),
      yearly: round(monthlyTotal * 12),
      byMonth,
    });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== GET /api/insights/comparison =====

export const getComparison = async (
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
      where: { userId, isActive: true },
    });

    const result = subscriptions.map((sub) => {
      const monthlyEquivalent = toMonthlyAmount(sub.amount, sub.billingCycle);
      const yearlyEquivalent = monthlyEquivalent * 12;

      // Estimated 15-20% savings if switching to annual (use 17.5% midpoint)
      let potentialSavings = 0;
      if (sub.billingCycle === 'monthly' || sub.billingCycle === 'weekly' || sub.billingCycle === 'quarterly') {
        potentialSavings = yearlyEquivalent * 0.175;
      }

      return {
        id: sub.id,
        name: sub.name,
        currentAmount: sub.amount,
        currentCycle: sub.billingCycle,
        monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100,
        yearlyEquivalent: Math.round(yearlyEquivalent * 100) / 100,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
      };
    });

    res.json({ subscriptions: result });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== GET /api/insights/score =====

async function getAlternatives(name: string, amount: number): Promise<{ name: string; price: string; description: string }[]> {
  try {
    const provider = (process.env.AI_PROVIDER as string) || 'groq';
    const prompt = `Suggest up to 3 cheaper or better alternatives to the subscription service "${name}" which costs $${amount}/month. Return ONLY a JSON array with objects having "name", "price", and "description" fields. No markdown, no explanation. Example: [{"name":"Alt","price":"$5/mo","description":"Similar features"}]`;

    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return parseAlternatives(text);
    } else {
      const Groq = (await import('groq-sdk')).default;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
      const completion = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
      });
      const text = completion.choices[0]?.message?.content?.trim() || '[]';
      return parseAlternatives(text);
    }
  } catch (err) {
    console.error('Failed to get alternatives:', err);
    return [];
  }
}

function parseAlternatives(text: string): { name: string; price: string; description: string }[] {
  try {
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map((item: any) => ({
        name: String(item.name || ''),
        price: String(item.price || ''),
        description: String(item.description || ''),
      }));
    }
  } catch { /* ignore parse errors */ }
  return [];
}

export const getScore = async (
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
      where: { userId, isActive: true },
    });

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const monthlyAmount = toMonthlyAmount(sub.amount, sub.billingCycle);

        // Calculate score (1-100)
        let score: number | null = null;
        let verdict: 'great value' | 'good' | 'consider canceling' | 'not rated' = 'not rated';

        if (sub.usageRating !== null && sub.usageRating !== undefined) {
          // Cost factor: lower cost = higher score (max 40 points)
          // $0 = 40pts, $50+ = 0pts
          const costScore = Math.max(0, 40 - (monthlyAmount / 50) * 40);

          // Usage factor: higher rating = higher score (max 50 points)
          const usageScore = (sub.usageRating / 5) * 50;

          // Longevity factor: longer subscribed = slight bonus (max 10 points)
          const monthsSubscribed = Math.max(1, Math.ceil(
            (Date.now() - new Date(sub.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
          ));
          const longevityScore = Math.min(10, monthsSubscribed);

          score = Math.round(Math.min(100, Math.max(1, costScore + usageScore + longevityScore)));

          if (score >= 70) verdict = 'great value';
          else if (score >= 45) verdict = 'good';
          else verdict = 'consider canceling';
        }

        const alternatives = await getAlternatives(sub.name, monthlyAmount);

        return {
          id: sub.id,
          name: sub.name,
          amount: sub.amount,
          usageRating: sub.usageRating,
          score,
          verdict,
          alternatives,
        };
      })
    );

    res.json({ subscriptions: results });
  } catch (error) {
    console.error('Score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== GET /api/insights/currency =====

export const getCurrencyConversion = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const baseCurrency = ((req.query.base as string) || 'USD').toUpperCase();

    const subscriptions = await prisma.subscription.findMany({
      where: { userId, isActive: true },
    });

    const rates = await getExchangeRates(baseCurrency);

    const converted = await Promise.all(
      subscriptions.map(async (sub) => {
        let convertedAmount = sub.amount;
        if (sub.currency.toUpperCase() !== baseCurrency) {
          try {
            convertedAmount = await convertCurrency(sub.amount, sub.currency, baseCurrency);
          } catch {
            // If conversion fails, keep original amount
          }
        }

        return {
          id: sub.id,
          name: sub.name,
          originalAmount: sub.amount,
          originalCurrency: sub.currency,
          convertedAmount,
          convertedCurrency: baseCurrency,
          billingCycle: sub.billingCycle,
        };
      })
    );

    const totalMonthly = converted.reduce((sum, sub) => {
      return sum + toMonthlyAmount(sub.convertedAmount, sub.billingCycle);
    }, 0);

    res.json({
      baseCurrency,
      subscriptions: converted,
      totalConverted: Math.round(totalMonthly * 100) / 100,
      rates,
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
