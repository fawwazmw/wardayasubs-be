import { describe, it, expect } from 'vitest';
import { request, createTestUser, createTestSubscription } from './helpers';

describe('Payment Endpoints', () => {
  // --- Create ---
  describe('POST /api/payments', () => {
    it('should record a payment', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id);

      const res = await request
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          subscriptionId: sub.id,
          amount: 9.99,
          currency: 'USD',
        });

      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(9.99);
      expect(res.body.subscription.id).toBe(sub.id);
    });

    it('should reject payment for non-owned subscription', async () => {
      const { user: user1 } = await createTestUser({ email: 'pay1@example.com' });
      const { token: token2 } = await createTestUser({ email: 'pay2@example.com' });
      const sub = await createTestSubscription(user1.id);

      const res = await request
        .post('/api/payments')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          subscriptionId: sub.id,
          amount: 9.99,
        });

      expect(res.status).toBe(404);
    });
  });

  // --- List ---
  describe('GET /api/payments', () => {
    it('should list user payments', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id);

      // Create a payment directly
      await request
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ subscriptionId: sub.id, amount: 9.99 });

      const res = await request
        .get('/api/payments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].subscription).toBeDefined();
    });

    it('should filter by subscription', async () => {
      const { token, user } = await createTestUser();
      const sub1 = await createTestSubscription(user.id, { name: 'Sub1' });
      const sub2 = await createTestSubscription(user.id, { name: 'Sub2' });

      await request.post('/api/payments').set('Authorization', `Bearer ${token}`)
        .send({ subscriptionId: sub1.id, amount: 10 });
      await request.post('/api/payments').set('Authorization', `Bearer ${token}`)
        .send({ subscriptionId: sub2.id, amount: 20 });

      const res = await request
        .get(`/api/payments?subscriptionId=${sub1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].amount).toBe(10);
    });
  });

  // --- Delete ---
  describe('DELETE /api/payments/:id', () => {
    it('should delete a payment', async () => {
      const { token, user } = await createTestUser();
      const sub = await createTestSubscription(user.id);

      const createRes = await request
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ subscriptionId: sub.id, amount: 9.99 });

      const res = await request
        .delete(`/api/payments/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });
});
