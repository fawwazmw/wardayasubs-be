import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@wardaya.com' },
    update: {},
    create: {
      email: 'demo@wardaya.com',
      password: hashedPassword,
      name: 'Demo User',
      currency: 'USD',
      emailVerified: true,
      isAdmin: false,
    },
  });
  console.log(`  User: ${user.email}`);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wardaya.com' },
    update: {},
    create: {
      email: 'admin@wardaya.com',
      password: adminPassword,
      name: 'Admin',
      currency: 'USD',
      emailVerified: true,
      isAdmin: true,
    },
  });
  console.log(`  Admin: ${admin.email}`);

  // Create categories
  const categories = [
    { name: 'Entertainment', color: '#EF4444' },
    { name: 'Productivity', color: '#3B82F6' },
    { name: 'Gaming', color: '#8B5CF6' },
    { name: 'Health & Fitness', color: '#10B981' },
    { name: 'News & Reading', color: '#F59E0B' },
    { name: 'Cloud & Storage', color: '#6366F1' },
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: cat.name } },
      update: {},
      create: { ...cat, userId: user.id },
    });
    createdCategories[cat.name] = created.id;
  }
  console.log(`  Categories: ${categories.length}`);

  // Create subscriptions
  const now = new Date();
  const subscriptions = [
    {
      name: 'Netflix',
      amount: 15.49,
      billingCycle: 'monthly',
      categoryName: 'Entertainment',
      daysUntilBilling: 12,
    },
    {
      name: 'Spotify',
      amount: 10.99,
      billingCycle: 'monthly',
      categoryName: 'Entertainment',
      daysUntilBilling: 5,
    },
    {
      name: 'YouTube Premium',
      amount: 13.99,
      billingCycle: 'monthly',
      categoryName: 'Entertainment',
      daysUntilBilling: 20,
    },
    {
      name: 'Notion',
      amount: 10.00,
      billingCycle: 'monthly',
      categoryName: 'Productivity',
      daysUntilBilling: 8,
    },
    {
      name: 'GitHub Pro',
      amount: 4.00,
      billingCycle: 'monthly',
      categoryName: 'Productivity',
      daysUntilBilling: 15,
    },
    {
      name: 'Xbox Game Pass',
      amount: 16.99,
      billingCycle: 'monthly',
      categoryName: 'Gaming',
      daysUntilBilling: 3,
    },
    {
      name: 'Headspace',
      amount: 69.99,
      billingCycle: 'yearly',
      categoryName: 'Health & Fitness',
      daysUntilBilling: 45,
    },
    {
      name: 'The New York Times',
      amount: 17.00,
      billingCycle: 'monthly',
      categoryName: 'News & Reading',
      daysUntilBilling: 22,
    },
    {
      name: 'iCloud+',
      amount: 2.99,
      billingCycle: 'monthly',
      categoryName: 'Cloud & Storage',
      daysUntilBilling: 10,
    },
    {
      name: 'Google One',
      amount: 29.99,
      billingCycle: 'yearly',
      categoryName: 'Cloud & Storage',
      daysUntilBilling: 60,
    },
  ];

  let subCount = 0;
  for (const sub of subscriptions) {
    const nextBilling = new Date(now);
    nextBilling.setDate(nextBilling.getDate() + sub.daysUntilBilling);

    const existing = await prisma.subscription.findFirst({
      where: { userId: user.id, name: sub.name },
    });

    if (!existing) {
      await prisma.subscription.create({
        data: {
          name: sub.name,
          amount: sub.amount,
          currency: 'USD',
          billingCycle: sub.billingCycle,
          nextBillingDate: nextBilling,
          categoryId: createdCategories[sub.categoryName],
          isActive: true,
          reminderDays: 3,
          userId: user.id,
        },
      });
      subCount++;
    }
  }
  console.log(`  Subscriptions: ${subCount}`);

  // Create a few notifications
  const notifications = [
    { message: 'Xbox Game Pass renews in 3 days ($16.99)', type: 'reminder' },
    { message: 'Spotify renews in 5 days ($10.99)', type: 'reminder' },
    { message: 'Welcome to Wardaya Subs!', type: 'info' },
  ];

  for (const notif of notifications) {
    await prisma.notification.create({
      data: { ...notif, userId: user.id },
    });
  }
  console.log(`  Notifications: ${notifications.length}`);

  console.log('Seed complete.');
  console.log('');
  console.log('Demo accounts:');
  console.log('  demo@wardaya.com / demo1234');
  console.log('  admin@wardaya.com / admin1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
