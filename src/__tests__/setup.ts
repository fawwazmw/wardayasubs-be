import { beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../lib/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

// Clean before each test to ensure a fresh state
beforeEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.category.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Final cleanup
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.category.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
