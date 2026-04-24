import Groq from 'groq-sdk';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import prisma from '../lib/prisma';

// Provider config
function getProvider(): 'groq' | 'gemini' {
  return (process.env.AI_PROVIDER as any) || 'groq';
}

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

You have access to ALL features of the app. Here is what you can do:

1. **Add subscription** — "I subscribed to Netflix for $15.99/month"
2. **Update subscription** — "change Spotify price to $12.99", "set Netflix category to Entertainment"
3. **Delete subscription** — "remove Netflix", "delete my Spotify subscription"
4. **Toggle subscription** — "pause Netflix", "deactivate Spotify", "reactivate Netflix"
5. **Record payment** — "I paid Netflix today", "paid $15.99 for Spotify", "record payment for Netflix"
6. **Create category** — "create a Gaming category", "add category Productivity with blue color"
7. **Delete category** — "delete the Gaming category"
8. **Query data** — "how much do I spend monthly?", "what renews this week?", "list my subscriptions", "show my categories", "how many payments this month?"
9. **Read receipts** — user uploads an image of a receipt/screenshot, extract subscription or payment details

CRITICAL RULES:
- Check the user's subscription list CAREFULLY before choosing an action.
- If a subscription ALREADY EXISTS, use "update_subscription" NOT "add_subscription".
- For payments: the user must reference an EXISTING subscription. Use the exact subscription name from their data.
- For delete/toggle: match the subscription name from the user's existing data.
- When the user mentions a category name, include "categoryName" in the data.
- For "record_payment": if the user doesn't specify an amount, use the subscription's current amount.
- For "toggle_subscription": set isActive to false for "pause/deactivate/cancel", true for "reactivate/resume/activate".

RESPONSE FORMAT:
- You MUST respond with valid JSON only. No markdown, no code blocks. Just raw JSON.
- If the user's request requires MULTIPLE steps (e.g. "create category Entertainment and add Spotify into it"), return a JSON ARRAY of actions. Execute them in order.
- If only ONE action is needed, return a single JSON object (not an array).

SINGLE ACTION example:
{"action":"record_payment","data":{"name":"Netflix","amount":15.99},"message":"Recorded payment for Netflix"}

MULTIPLE ACTIONS example:
[{"action":"create_category","data":{"categoryName":"Entertainment","color":"#EF4444"},"message":"Created Entertainment category"},{"action":"update_subscription","data":{"name":"Spotify","categoryName":"Entertainment"},"message":"Added Spotify to Entertainment category"}]

AVAILABLE ACTIONS:

{"action":"add_subscription","data":{"name":"string","amount":number,"currency":"USD","billingCycle":"monthly|yearly|weekly|quarterly","categoryName":"optional"},"message":"..."}
{"action":"update_subscription","data":{"name":"exact existing name","amount":number,"currency":"USD","billingCycle":"string","categoryName":"optional"},"message":"..."}
{"action":"delete_subscription","data":{"name":"exact existing name"},"message":"..."}
{"action":"toggle_subscription","data":{"name":"exact existing name","isActive":true|false},"message":"..."}
{"action":"record_payment","data":{"name":"exact existing subscription name","amount":number,"currency":"USD","paidAt":"YYYY-MM-DD or omit for today"},"message":"..."}
{"action":"create_category","data":{"categoryName":"string","color":"#hex or omit"},"message":"..."}
{"action":"delete_category","data":{"categoryName":"exact existing category name"},"message":"..."}
{"action":"start_trial","data":{"name":"string","amount":number,"trialEndsAt":"YYYY-MM-DD"},"message":"..."}
{"action":"rate_subscription","data":{"name":"exact existing name","usageRating":1-5},"message":"..."}
{"action":"share_subscription","data":{"name":"exact existing name","totalMembers":number},"message":"..."}
{"action":"query","message":"your answer based on the data — you can also answer questions about spending forecasts, annual vs monthly comparisons, and subscription value scores"}
{"action":"chat","message":"your response"}
{"action":"clarify","message":"what you need"}

Currency: Default USD. $ = USD, € = EUR, £ = GBP, Rp = IDR.
Billing cycle: Default "monthly". Look for "yearly/annual/weekly/quarterly".
Date: If user says "today", use today's date. If not specified, omit paidAt.`;

export type ChatActionType =
  | 'add_subscription'
  | 'update_subscription'
  | 'delete_subscription'
  | 'toggle_subscription'
  | 'record_payment'
  | 'create_category'
  | 'delete_category'
  | 'start_trial'
  | 'rate_subscription'
  | 'share_subscription'
  | 'query'
  | 'chat'
  | 'clarify';

export interface ChatAction {
  action: ChatActionType;
  data?: {
    name?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    categoryName?: string;
    color?: string;
    isActive?: boolean;
    paidAt?: string;
    trialEndsAt?: string;
    usageRating?: number;
    totalMembers?: number;
  };
  message: string;
}

export type ChatResult = ChatAction | ChatAction[];

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
  if (role === 'user') {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (session && session.title === 'New Chat') {
      const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
      await prisma.chatSession.update({ where: { id: sessionId }, data: { title } });
    }
  }
}

async function saveResultMessages(sessionId: string, result: ChatResult) {
  if (Array.isArray(result)) {
    const combined = result.map(r => r.message).join('\n');
    const actions = result.map(r => r.action).join(',');
    await saveMessage(sessionId, 'assistant', combined, actions);
  } else {
    await saveMessage(sessionId, 'assistant', result.message, result.action);
  }
}

// ===== Context Builders =====

async function getFullContext(userId: string): Promise<string> {
  const [subscriptions, categories, recentPayments] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { nextBillingDate: 'asc' },
    }),
    prisma.category.findMany({
      where: { userId },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.payment.findMany({
      where: { subscription: { userId } },
      include: { subscription: { select: { name: true } } },
      orderBy: { paidAt: 'desc' },
      take: 10,
    }),
  ]);

  let context = '\n\n--- USER DATA ---';

  // Subscriptions
  if (subscriptions.length === 0) {
    context += '\n\nSubscriptions: None yet.';
  } else {
    context += `\n\nSubscriptions (${subscriptions.length}):`;
    for (const s of subscriptions) {
      const daysUntil = Math.max(0, Math.ceil((new Date(s.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      context += `\n- ${s.name}: ${s.currency} ${s.amount}/${s.billingCycle}, next in ${daysUntil}d${s.isActive ? '' : ' (INACTIVE)'}${s.category ? `, category: ${s.category.name}` : ''}`;
    }
  }

  // Categories
  if (categories.length === 0) {
    context += '\n\nCategories: None yet.';
  } else {
    context += `\n\nCategories (${categories.length}):`;
    for (const c of categories) {
      context += `\n- ${c.name} (${c.color || 'no color'}, ${c._count.subscriptions} subs)`;
    }
  }

  // Recent payments
  if (recentPayments.length === 0) {
    context += '\n\nRecent payments: None yet.';
  } else {
    context += `\n\nRecent payments (last ${recentPayments.length}):`;
    for (const p of recentPayments) {
      const date = new Date(p.paidAt).toISOString().split('T')[0];
      context += `\n- ${p.subscription.name}: ${p.currency} ${p.amount} on ${date}`;
    }
  }

  context += `\n\nToday's date: ${new Date().toISOString().split('T')[0]}`;

  return context;
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
    { type: 'text', text: userMessage || 'Analyze this receipt/screenshot and extract subscription or payment details.' },
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

export async function processTextMessage(userId: string, sessionId: string, message: string): Promise<ChatResult> {
  const userContext = await getFullContext(userId);
  const fullSystemPrompt = SYSTEM_PROMPT + userContext;
  const history = await getSessionHistory(sessionId);
  const provider = getProvider();

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
    await saveResultMessages(sessionId, result);
    return result;
  } catch (err: any) {
    console.error(`[Chat] ${provider} error:`, err.message);
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
      await saveResultMessages(sessionId, result);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat] ${fallback} fallback also failed:`, fallbackErr.message);
    }
    const errorResult: ChatAction = { action: 'chat', message: 'Sorry, the AI service is temporarily unavailable. Please try again.' };
    await saveMessage(sessionId, 'assistant', errorResult.message);
    return errorResult;
  }
}

export async function processImageMessage(userId: string, sessionId: string, imageBuffer: Buffer, mimeType: string, userMessage?: string): Promise<ChatResult> {
  const imageBase64 = imageBuffer.toString('base64');
  const userContext = await getFullContext(userId);
  const fullSystemPrompt = SYSTEM_PROMPT + userContext;
  const history = await getSessionHistory(sessionId);
  const provider = getProvider();
  const imagePrompt = `${fullSystemPrompt}\n\nThe user uploaded an image. Analyze it and extract subscription or payment details.${userMessage ? `\n\nUser's message: ${userMessage}` : ''}`;

  await saveMessage(sessionId, 'user', userMessage || '[Uploaded an image for analysis]');

  try {
    let text: string;
    if (provider === 'groq') {
      text = await callGroqVision(fullSystemPrompt, history, imageBase64, mimeType, userMessage);
    } else {
      text = await callGeminiVision(imagePrompt, imageBase64, mimeType);
    }
    const result = parseResponse(text);
    await saveResultMessages(sessionId, result);
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
      await saveResultMessages(sessionId, result);
      return result;
    } catch (fallbackErr: any) {
      console.error(`[Chat] ${fallback} vision fallback also failed:`, fallbackErr.message);
    }
    const errorResult: ChatAction = { action: 'chat', message: 'Sorry, I could not analyze that image. Please try again or describe it manually.' };
    await saveMessage(sessionId, 'assistant', errorResult.message);
    return errorResult;
  }
}

function parseResponse(text: string): ChatResult {
  try {
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(cleaned);

    // Array of actions
    if (Array.isArray(parsed)) {
      const actions: ChatAction[] = parsed
        .filter((item: any) => item.action && item.message)
        .map((item: any) => ({ action: item.action, data: item.data || undefined, message: item.message }));
      if (actions.length > 0) return actions;
    }

    // Single action
    if (parsed.action && parsed.message) {
      return { action: parsed.action, data: parsed.data || undefined, message: parsed.message };
    }
  } catch { /* treat as plain chat */ }
  return { action: 'chat', message: text };
}
