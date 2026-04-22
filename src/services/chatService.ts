import Groq from 'groq-sdk';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import prisma from '../lib/prisma';

// Provider config
function getProvider(): 'groq' | 'gemini' {
  return (process.env.AI_PROVIDER as any) || 'groq';
}

// Lazy clients
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return groqClient;
}

let geminiClient: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  return geminiClient;
}

const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are Wardaya, a helpful AI assistant for a subscription tracking app called "Wardaya Subs".

You can help users with:
1. **Adding subscriptions** — When a user says something like "I just subscribed to Netflix for $15.99/month", extract the details.
2. **Updating subscriptions** — When a user says "change Spotify to $12.99" or "set Netflix category to Entertainment", update the existing subscription instead of creating a new one.
3. **Reading receipts/screenshots** — When a user uploads an image of a receipt or subscription confirmation, extract the subscription details.
4. **Querying subscriptions** — Answer questions like "how much do I spend monthly?", "what renews this week?", "list my subscriptions", etc.

CRITICAL RULES:
- If a subscription with the same name ALREADY EXISTS in the user's data, use "update_subscription" action, NOT "add_subscription". Check the user's subscription list carefully.
- Only use "add_subscription" for subscriptions that do NOT already exist.
- When the user mentions a category, include "categoryName" in the data.

IMPORTANT RESPONSE FORMAT:
You MUST respond with valid JSON only. No markdown, no code blocks, no extra text. Just raw JSON.

For ADDING a NEW subscription (only if it does NOT exist yet):
{"action":"add_subscription","data":{"name":"string","amount":number,"currency":"USD","billingCycle":"monthly|yearly|weekly|quarterly","categoryName":"optional category name"},"message":"string describing what you did"}

For UPDATING an EXISTING subscription:
{"action":"update_subscription","data":{"name":"exact existing name to match","amount":number,"currency":"USD","billingCycle":"monthly|yearly|weekly|quarterly","categoryName":"optional category name"},"message":"string describing what you updated"}

For querying subscriptions:
{"action":"query","message":"your helpful answer based on the subscription data provided"}

For general conversation:
{"action":"chat","message":"your response"}

If unclear or need more info:
{"action":"clarify","message":"what you need clarified"}

Currency: Default USD. Symbols: $ = USD, € = EUR, £ = GBP, Rp = IDR.
Billing cycle: Look for "monthly", "yearly", "annual", "/mo", "/yr". Default "monthly" if unclear.`;

export interface ChatAction {
  action: 'add_subscription' | 'update_subscription' | 'query' | 'chat' | 'clarify';
  data?: {
    name: string;
    amount: number;
    currency: string;
    billingCycle: string;
    categoryName?: string;
  };
  message: string;
}

// ===== DB Session Helpers =====

async function getSessionHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: MAX_HISTORY,
    select: { role: true, content: true },
  });
  return messages;
}

async function saveMessage(sessionId: string, role: string, content: string, action?: string) {
  await prisma.chatMessage.create({
    data: { role, content, action, sessionId },
  });

  // Auto-title: update session title from first user message
  if (role === 'user') {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (session && session.title === 'New Chat') {
      const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }
  }
}

// ===== Subscription Context =====

async function getSubscriptionContext(userId: string): Promise<string> {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { nextBillingDate: 'asc' },
  });

  if (subscriptions.length === 0) return '\n\nUser has no subscriptions yet.';

  return `\n\nUser's current subscriptions:\n${subscriptions.map(s => {
    const daysUntil = Math.max(0, Math.ceil((new Date(s.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return `- ${s.name}: ${s.currency} ${s.amount}/${s.billingCycle}, next billing in ${daysUntil} days${s.isActive ? '' : ' (INACTIVE)'}${s.category ? `, category: ${s.category.name}` : ', no category'}`;
  }).join('\n')}`;
}

// ===== AI Calls =====

async function callGroqText(systemPrompt: string, history: { role: string; content: string }[], userMessage: string): Promise<string> {
  const groq = getGroq();
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 1024,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

async function callGroqVision(systemPrompt: string, history: { role: string; content: string }[], imageBase64: string, mimeType: string, userMessage?: string): Promise<string> {
  const groq = getGroq();
  const userContent: any[] = [
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
    { type: 'text', text: userMessage || 'Analyze this receipt/screenshot and extract subscription details.' },
  ];
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 1024,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

async function callGeminiText(prompt: string): Promise<string> {
  const model = getGemini().getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function callGeminiVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const model = getGemini().getGenerativeModel({ model: GEMINI_MODEL });
  const imagePart: Part = { inlineData: { data: imageBase64, mimeType } };
  const result = await model.generateContent([prompt, imagePart]);
  return result.response.text().trim();
}

// ===== Main API =====

export async function processTextMessage(userId: string, sessionId: string, message: string): Promise<ChatAction> {
  const subContext = await getSubscriptionContext(userId);
  const fullSystemPrompt = SYSTEM_PROMPT + subContext;
  const history = await getSessionHistory(sessionId);
  const provider = getProvider();

  // Save user message
  await saveMessage(sessionId, 'user', message);

  try {
    let text: string;
    if (provider === 'groq') {
      text = await callGroqText(fullSystemPrompt, history, message);
    } else {
      const historyText = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const fullPrompt = historyText
        ? `${fullSystemPrompt}\n\nConversation so far:\n${historyText}\n\nUser message: ${message}`
        : `${fullSystemPrompt}\n\nUser message: ${message}`;
      text = await callGeminiText(fullPrompt);
    }

    const result = parseResponse(text);
    await saveMessage(sessionId, 'assistant', result.message, result.action);
    return result;
  } catch (err: any) {
    console.error(`[Chat] ${provider} error:`, err.message);

    // Fallback
    const fallback = provider === 'groq' ? 'gemini' : 'groq';
    try {
      console.warn(`[Chat] Falling back to ${fallback}`);
      let text: string;
      if (fallback === 'groq') {
        text = await callGroqText(fullSystemPrompt, history, message);
      } else {
        text = await callGeminiText(`${fullSystemPrompt}\n\nUser message: ${message}`);
      }
      const result = parseResponse(text);
      await saveMessage(sessionId, 'assistant', result.message, result.action);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat] ${fallback} fallback also failed:`, fallbackErr.message);
    }

    const errorResult: ChatAction = {
      action: 'chat',
      message: 'Sorry, the AI service is temporarily unavailable. Please try again in a moment.',
    };
    await saveMessage(sessionId, 'assistant', errorResult.message);
    return errorResult;
  }
}

export async function processImageMessage(userId: string, sessionId: string, imageBuffer: Buffer, mimeType: string, userMessage?: string): Promise<ChatAction> {
  const imageBase64 = imageBuffer.toString('base64');
  const subContext = await getSubscriptionContext(userId);
  const fullSystemPrompt = SYSTEM_PROMPT + subContext;
  const history = await getSessionHistory(sessionId);
  const provider = getProvider();
  const imagePrompt = `${fullSystemPrompt}\n\nThe user uploaded an image (likely a receipt, invoice, or subscription confirmation screenshot). Analyze it and extract subscription details if possible.${userMessage ? `\n\nUser's additional message: ${userMessage}` : ''}`;

  await saveMessage(sessionId, 'user', userMessage || '[Uploaded an image for analysis]');

  try {
    let text: string;
    if (provider === 'groq') {
      text = await callGroqVision(fullSystemPrompt, history, imageBase64, mimeType, userMessage);
    } else {
      text = await callGeminiVision(imagePrompt, imageBase64, mimeType);
    }

    const result = parseResponse(text);
    await saveMessage(sessionId, 'assistant', result.message, result.action);
    return result;
  } catch (err: any) {
    console.error(`[Chat] ${provider} vision error:`, err.message);

    const fallback = provider === 'groq' ? 'gemini' : 'groq';
    try {
      console.warn(`[Chat] Falling back to ${fallback} for vision`);
      let text: string;
      if (fallback === 'groq') {
        text = await callGroqVision(fullSystemPrompt, history, imageBase64, mimeType, userMessage);
      } else {
        text = await callGeminiVision(imagePrompt, imageBase64, mimeType);
      }
      const result = parseResponse(text);
      await saveMessage(sessionId, 'assistant', result.message, result.action);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat] ${fallback} vision fallback also failed:`, fallbackErr.message);
    }

    const errorResult: ChatAction = {
      action: 'chat',
      message: 'Sorry, I could not analyze that image. Please try again later or describe the subscription manually.',
    };
    await saveMessage(sessionId, 'assistant', errorResult.message);
    return errorResult;
  }
}

function parseResponse(text: string): ChatAction {
  try {
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (parsed.action && parsed.message) {
      return { action: parsed.action, data: parsed.data || undefined, message: parsed.message };
    }
  } catch { /* treat as plain chat */ }
  return { action: 'chat', message: text };
}
