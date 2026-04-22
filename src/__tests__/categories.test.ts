import { describe, it, expect } from 'vitest';
import { request, createTestUser, createTestCategory } from './helpers';

describe('Category Endpoints', () => {
  // --- Create ---
  describe('POST /api/categories', () => {
    it('should create a category', async () => {
      const { token } = await createTestUser();

      const res = await request
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Entertainment', color: '#EF4444' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Entertainment');
      expect(res.body.color).toBe('#EF4444');
    });

    it('should reject duplicate category name for same user', async () => {
      const { token, user } = await createTestUser();
      await createTestCategory(user.id, { name: 'Duplicate' });

      const res = await request
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Duplicate' });

      expect(res.status).toBe(400);
    });

    it('should allow same name for different users', async () => {
      const { user: user1 } = await createTestUser({ email: 'cat1@example.com' });
      const { token: token2 } = await createTestUser({ email: 'cat2@example.com' });
      await createTestCategory(user1.id, { name: 'Shared Name' });

      const res = await request
        .post('/api/categories')
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Shared Name' });

      expect(res.status).toBe(201);
    });
  });

  // --- List ---
  describe('GET /api/categories', () => {
    it('should list user categories with subscription count', async () => {
      const { token, user } = await createTestUser();
      await createTestCategory(user.id, { name: 'Cat A' });
      await createTestCategory(user.id, { name: 'Cat B' });

      const res = await request
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]._count).toBeDefined();
    });
  });

  // --- Get by ID ---
  describe('GET /api/categories/:id', () => {
    it('should return a single category', async () => {
      const { token, user } = await createTestUser();
      const cat = await createTestCategory(user.id, { name: 'Single' });

      const res = await request
        .get(`/api/categories/${cat.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Single');
    });

    it('should return 404 for non-existent category', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/categories/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // --- Update ---
  describe('PUT /api/categories/:id', () => {
    it('should update a category', async () => {
      const { token, user } = await createTestUser();
      const cat = await createTestCategory(user.id, { name: 'Old Name' });

      const res = await request
        .put(`/api/categories/${cat.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name', color: '#10B981' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.color).toBe('#10B981');
    });
  });

  // --- Delete ---
  describe('DELETE /api/categories/:id', () => {
    it('should delete a category', async () => {
      const { token, user } = await createTestUser();
      const cat = await createTestCategory(user.id, { name: 'ToDelete' });

      const res = await request
        .delete(`/api/categories/${cat.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
