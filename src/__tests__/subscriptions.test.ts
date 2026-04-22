import { describe, it, expect } from 'vitest';
import { request, createTestUser, createTestSubscription, createTestCategory } from './helpers';

describe('Subscription Endpoints', () => {
  // --- Create ---
  describe('POST /api/subscriptions', () => {
    it('should create a subscription', async () => {
      const { token } = await createTestUser();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Netflix',
          amount: 15.99,
          currency: 'USD',
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Netflix');
      expect(res.body.amount).toBe(15.99);
      expect(res.body.billingCycle).toBe('monthly');
    });

    it('should create with category', async () => {
      const { token, user } = await createTestUser();
      const category = await createTestCategory(user.id, { name: 'Entertainment' });
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Spotify',
          amount: 9.99,
          billingCycle: 'monthly',
          nextBillingDate: nextMonth.toISOString(),
          categoryId: category.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe('Entertainment');
    });

    it('should reject missing required fields', async () => {
      const { token } = await createTestUser();

      const res = await request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request.post('/api/subscriptions').send({
        name: 'Test',
        amount: 5,
        billingCycle: 'monthly',
        nextBillingDate: new Date().toISOString(),
      });

      expect(res.status).toBe(401);
    });
  });

  // --- List ---
  describe('GET /api/subscriptions', () => {
    it('should list user subscriptions', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Sub A' });
      await createTestSubscription(user.id, { name: 'Sub B' });

      const res = await request
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should not return other users subscriptions', async () => {
      const { user: user1 } = await createTestUser({ email: 'user1@example.com' });
      const { token: token2 } = await createTestUser({ email: 'user2@example.com' });
      await createTestSubscription(user1.id, { name: 'User1 Sub' });

      const res = await request
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should filter by active status', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Active', isActive: true });
      await createTestSubscription(user.id, { name: 'Inactive', isActive: false });

      const res = await request
        .get('/api/subscriptions?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active');
    });
  });

  // --- Get by ID ---
  describe('GET /api/subscriptions/:id', () => {
    it('should return a single subscription', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id, { name: 'MySub' });

      const res = await request
        .get(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('MySub');
    });

    it('should return 404 for non-existent subscription', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/subscriptions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // --- Update ---
  describe('PUT /api/subscriptions/:id', () => {
    it('should update a subscription', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id);

      const res = await request
        .put(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', amount: 19.99 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.amount).toBe(19.99);
    });

    it('should toggle active status', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id, { isActive: true });

      const res = await request
        .put(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  // --- Delete ---
  describe('DELETE /api/subscriptions/:id', () => {
    it('should delete a subscription', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id);

      const res = await request
        .delete(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request
        .get(`/api/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });
  });

  // --- Bulk Delete ---
  describe('POST /api/subscriptions/bulk-delete', () => {
    it('should delete multiple subscriptions', async () => {
      const { token, user } = await createTestUser();
      const sub1 = await createTestSubscription(user.id, { name: 'Del1' });
      const sub2 = await createTestSubscription(user.id, { name: 'Del2' });

      const res = await request
        .post('/api/subscriptions/bulk-delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [sub1.id, sub2.id] });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  // --- Stats ---
  describe('GET /api/subscriptions/stats', () => {
    it('should return analytics', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { amount: 10, billingCycle: 'monthly' });
      await createTestSubscription(user.id, { amount: 120, billingCycle: 'yearly' });

      const res = await request
        .get('/api/subscriptions/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalSubscriptions).toBe(2);
      expect(res.body.monthlyTotal).toBeGreaterThan(0);
      expect(res.body.yearlyTotal).toBeGreaterThan(0);
    });
  });

  // --- Upcoming ---
  describe('GET /api/subscriptions/upcoming', () => {
    it('should return upcoming renewals', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id);

      const res = await request
        .get('/api/subscriptions/upcoming?days=60')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
