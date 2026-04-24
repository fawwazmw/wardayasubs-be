import { describe, it, expect } from 'vitest';
import { request, createTestUser, createTestSubscription } from './helpers';

describe('Insights Endpoints', () => {
  // ===== Forecast =====
  describe('GET /api/insights/forecast', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/insights/forecast');
      expect(res.status).toBe(401);
    });

    it('should return forecast data with all expected fields', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Netflix', amount: 15, billingCycle: 'monthly' });

      const res = await request
        .get('/api/insights/forecast')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('monthly');
      expect(res.body).toHaveProperty('threeMonth');
      expect(res.body).toHaveProperty('sixMonth');
      expect(res.body).toHaveProperty('yearly');
      expect(res.body).toHaveProperty('byMonth');
      expect(res.body.byMonth).toHaveLength(12);
    });

    it('should return zeros when no subscriptions', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/insights/forecast')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.monthly).toBe(0);
      expect(res.body.threeMonth).toBe(0);
      expect(res.body.sixMonth).toBe(0);
      expect(res.body.yearly).toBe(0);
      expect(res.body.byMonth).toHaveLength(12);
      res.body.byMonth.forEach((m: { month: string; amount: number }) => {
        expect(m.amount).toBe(0);
      });
    });

    it('should calculate correctly for mixed billing cycles', async () => {
      const { token, user } = await createTestUser();
      // Monthly: $12/mo => $12 monthly
      await createTestSubscription(user.id, { name: 'Monthly Sub', amount: 12, billingCycle: 'monthly' });
      // Yearly: $120/yr => $10 monthly
      await createTestSubscription(user.id, { name: 'Yearly Sub', amount: 120, billingCycle: 'yearly' });

      const res = await request
        .get('/api/insights/forecast')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // 12 + (120/12) = 12 + 10 = 22
      expect(res.body.monthly).toBe(22);
      expect(res.body.threeMonth).toBe(66);
      expect(res.body.sixMonth).toBe(132);
      expect(res.body.yearly).toBe(264);
    });
  });

  // ===== Comparison =====
  describe('GET /api/insights/comparison', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/insights/comparison');
      expect(res.status).toBe(401);
    });

    it('should return comparison data for each subscription', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Sub A', amount: 10, billingCycle: 'monthly' });
      await createTestSubscription(user.id, { name: 'Sub B', amount: 120, billingCycle: 'yearly' });

      const res = await request
        .get('/api/insights/comparison')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toHaveLength(2);

      const subA = res.body.subscriptions.find((s: any) => s.name === 'Sub A');
      const subB = res.body.subscriptions.find((s: any) => s.name === 'Sub B');

      expect(subA).toBeDefined();
      expect(subB).toBeDefined();
      expect(subA).toHaveProperty('id');
      expect(subA).toHaveProperty('currentAmount');
      expect(subA).toHaveProperty('currentCycle');
      expect(subA).toHaveProperty('monthlyEquivalent');
      expect(subA).toHaveProperty('yearlyEquivalent');
      expect(subA).toHaveProperty('potentialSavings');
    });

    it('should calculate potential savings for monthly subs', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Monthly', amount: 10, billingCycle: 'monthly' });

      const res = await request
        .get('/api/insights/comparison')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sub = res.body.subscriptions[0];
      // Monthly $10 => yearly $120 => 17.5% savings = $21
      expect(sub.potentialSavings).toBe(21);
      expect(sub.monthlyEquivalent).toBe(10);
      expect(sub.yearlyEquivalent).toBe(120);
    });

    it('should show zero savings for yearly subs', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Yearly', amount: 120, billingCycle: 'yearly' });

      const res = await request
        .get('/api/insights/comparison')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sub = res.body.subscriptions[0];
      expect(sub.potentialSavings).toBe(0);
    });
  });

  // ===== Score =====
  describe('GET /api/insights/score', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/insights/score');
      expect(res.status).toBe(401);
    });

    it('should return scores for subscriptions with usage ratings', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Rated Sub', amount: 10, usageRating: 4 });

      const res = await request
        .get('/api/insights/score')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toHaveLength(1);

      const sub = res.body.subscriptions[0];
      expect(sub.name).toBe('Rated Sub');
      expect(sub.usageRating).toBe(4);
      expect(sub.score).toBeTypeOf('number');
      expect(sub.score).toBeGreaterThanOrEqual(1);
      expect(sub.score).toBeLessThanOrEqual(100);
      expect(['great value', 'good', 'consider canceling']).toContain(sub.verdict);
    });

    it('should return "not rated" verdict for subs without ratings', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Unrated Sub', amount: 10 });

      const res = await request
        .get('/api/insights/score')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sub = res.body.subscriptions[0];
      expect(sub.score).toBeNull();
      expect(sub.verdict).toBe('not rated');
    });

    it('should return alternatives array (may be empty if AI unavailable)', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Test Sub', amount: 10, usageRating: 3 });

      const res = await request
        .get('/api/insights/score')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sub = res.body.subscriptions[0];
      expect(Array.isArray(sub.alternatives)).toBe(true);
    });
  });

  // ===== Currency =====
  describe('GET /api/insights/currency', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/insights/currency');
      expect(res.status).toBe(401);
    });

    it('should return currency conversion data', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'USD Sub', amount: 10, currency: 'USD' });

      const res = await request
        .get('/api/insights/currency')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('baseCurrency');
      expect(res.body).toHaveProperty('subscriptions');
      expect(res.body).toHaveProperty('totalConverted');
      expect(res.body).toHaveProperty('rates');
      expect(res.body.subscriptions).toHaveLength(1);

      const sub = res.body.subscriptions[0];
      expect(sub).toHaveProperty('originalAmount');
      expect(sub).toHaveProperty('originalCurrency');
      expect(sub).toHaveProperty('convertedAmount');
      expect(sub).toHaveProperty('convertedCurrency');
      expect(sub).toHaveProperty('billingCycle');
    });

    it('should accept base currency query param', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'Sub', amount: 10, currency: 'USD' });

      const res = await request
        .get('/api/insights/currency?base=EUR')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.baseCurrency).toBe('EUR');
    });

    it('should handle same-currency subscriptions (no conversion needed)', async () => {
      const { token, user } = await createTestUser();
      await createTestSubscription(user.id, { name: 'USD Sub', amount: 25, currency: 'USD' });

      const res = await request
        .get('/api/insights/currency?base=USD')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const sub = res.body.subscriptions[0];
      // Same currency: converted amount should equal original
      expect(sub.convertedAmount).toBe(25);
      expect(sub.originalAmount).toBe(25);
      expect(sub.originalCurrency).toBe('USD');
      expect(sub.convertedCurrency).toBe('USD');
    });
  });
});
