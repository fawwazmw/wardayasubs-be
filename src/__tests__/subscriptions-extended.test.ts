import { describe, it, expect } from 'vitest';
import { request, createTestUser, createTestSubscription } from './helpers';

describe('Subscription Extended Fields', () => {
  // ===== Trial Fields =====
  describe('Create with trial fields', () => {
    it('should create a trial subscription with isTrial=true and trialEndsAt', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Trial Service',
          amount: 9.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
          isTrial: true,
          trialEndsAt: trialEnd.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Trial Service');
      expect(res.body.isTrial).toBe(true);
      expect(res.body.trialEndsAt).toBeTruthy();
      // Verify the date is close to what we sent
      const returnedDate = new Date(res.body.trialEndsAt);
      expect(Math.abs(returnedDate.getTime() - trialEnd.getTime())).toBeLessThan(2000);
    });

    it('should default isTrial to false', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Regular Service',
          amount: 9.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.isTrial).toBe(false);
      expect(res.body.trialEndsAt).toBeNull();
    });
  });

  // ===== Sharing Fields =====
  describe('Create with sharing fields', () => {
    it('should create a shared subscription with isShared=true and totalMembers', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Family Plan',
          amount: 19.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
          isShared: true,
          totalMembers: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Family Plan');
      expect(res.body.isShared).toBe(true);
      expect(res.body.totalMembers).toBe(4);
    });

    it('should default isShared to false and totalMembers to 1', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Solo Plan',
          amount: 9.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.isShared).toBe(false);
      expect(res.body.totalMembers).toBe(1);
    });
  });

  // ===== Usage Rating =====
  describe('Create with usage rating', () => {
    it('should create subscription with usageRating (1-5)', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Rated Service',
          amount: 14.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
          usageRating: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.usageRating).toBe(4);
    });

    it('should reject usageRating outside 1-5 range', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bad Rating',
          amount: 9.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
          usageRating: 10,
        });

      expect(res.status).toBe(400);
    });
  });

  // ===== Update trial/sharing/rating =====
  describe('Update trial/sharing/rating fields', () => {
    it('should update isTrial and trialEndsAt', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id, { name: 'Upgrade Me' });
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const res = await request
        .put(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          isTrial: true,
          trialEndsAt: trialEnd.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.isTrial).toBe(true);
      expect(res.body.trialEndsAt).toBeTruthy();
    });

    it('should update isShared and totalMembers', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id, { name: 'Share Me' });

      const res = await request
        .put(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          isShared: true,
          totalMembers: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body.isShared).toBe(true);
      expect(res.body.totalMembers).toBe(3);
    });

    it('should update usageRating', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id, { name: 'Rate Me' });

      const res = await request
        .put(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ usageRating: 5 });

      expect(res.status).toBe(200);
      expect(res.body.usageRating).toBe(5);

      // Verify via GET
      const getRes = await request
        .get(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.usageRating).toBe(5);
    });
  });
});
