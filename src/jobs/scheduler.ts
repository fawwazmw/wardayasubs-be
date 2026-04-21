import cron from 'node-cron';
import prisma from '../lib/prisma';
import { sendRenewalReminderEmail } from '../utils/email';

function addBillingCycle(date: Date, cycle: string): Date {
  const next = new Date(date);
  switch (cycle) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// Runs daily at midnight - advances nextBillingDate for past-due active subscriptions
async function advanceBillingDates() {
  try {
    const now = new Date();

    const pastDue = await prisma.subscription.findMany({
      where: {
        isActive: true,
        nextBillingDate: { lt: now },
      },
    });

    if (pastDue.length === 0) return;

    let advanced = 0;
    for (const sub of pastDue) {
      let nextDate = new Date(sub.nextBillingDate);
      // Keep advancing until the date is in the future
      while (nextDate < now) {
        nextDate = addBillingCycle(nextDate, sub.billingCycle);
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextBillingDate: nextDate },
      });
      advanced++;
    }

    if (advanced > 0) {
      console.log(`📅 Advanced billing dates for ${advanced} subscription(s)`);
    }
  } catch (error) {
    console.error('Scheduler error (advance billing):', error);
  }
}

// Creates reminder notifications + sends email for subscriptions billing within reminderDays
async function generateReminders() {
  try {
    const now = new Date();

    const subscriptions = await prisma.subscription.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    // Group upcoming reminders by user
    const userReminders: Record<string, {
      email: string;
      name: string;
      items: { name: string; amount: number; currency: string; daysUntil: number }[];
    }> = {};

    let created = 0;
    for (const sub of subscriptions) {
      const daysUntil = Math.ceil(
        (sub.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil > 0 && daysUntil <= sub.reminderDays) {
        // Check if we already sent a reminder for this subscription today
        const existing = await prisma.notification.findFirst({
          where: {
            userId: sub.userId,
            message: { contains: sub.name },
            type: 'reminder',
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!existing) {
          const dayText = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
          await prisma.notification.create({
            data: {
              userId: sub.userId,
              type: 'reminder',
              message: `${sub.name} (${sub.currency} ${sub.amount}) renews ${dayText}`,
            },
          });
          created++;

          // Collect for email
          if (!userReminders[sub.userId]) {
            userReminders[sub.userId] = {
              email: sub.user.email,
              name: sub.user.name,
              items: [],
            };
          }
          userReminders[sub.userId].items.push({
            name: sub.name,
            amount: sub.amount,
            currency: sub.currency,
            daysUntil,
          });
        }
      }
    }

    // Send one email per user with all their reminders
    for (const userId of Object.keys(userReminders)) {
      const { email, name, items } = userReminders[userId];
      try {
        await sendRenewalReminderEmail(email, name, items);
      } catch (err) {
        console.error(`Failed to send reminder email to ${email}:`, err);
      }
    }

    if (created > 0) {
      console.log(`🔔 Created ${created} renewal reminder(s), emailed ${Object.keys(userReminders).length} user(s)`);
    }
  } catch (error) {
    console.error('Scheduler error (reminders):', error);
  }
}

export function startScheduler() {
  // Run daily at 00:05
  cron.schedule('5 0 * * *', () => {
    console.log('⏰ Running daily jobs...');
    advanceBillingDates();
    generateReminders();
  });

  // Also run once on startup to catch up
  advanceBillingDates();
  generateReminders();

  console.log('📆 Scheduler started - billing dates and reminders run daily');
}
