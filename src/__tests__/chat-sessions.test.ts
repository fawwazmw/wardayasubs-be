import { describe, it, expect } from 'vitest';
import { request, createTestUser } from './helpers';

describe('Chat Session Endpoints', () => {
  // ===== Create Session =====
  describe('POST /api/chat/sessions', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.post('/api/chat/sessions').send({});
      expect(res.status).toBe(401);
    });

    it('should create a new session', async () => {
      const { token } = await createTestUser();

      const res = await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Chat' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('My Chat');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('should default title to "New Chat"', async () => {
      const { token } = await createTestUser();

      const res = await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Chat');
    });
  });

  // ===== List Sessions =====
  describe('GET /api/chat/sessions', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/chat/sessions');
      expect(res.status).toBe(401);
    });

    it('should list user sessions', async () => {
      const { token } = await createTestUser();

      // Create two sessions
      await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Session 1' });
      await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Session 2' });

      const res = await request
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('title');
      expect(res.body[0]).toHaveProperty('_count');
    });

    it('should not return other users sessions', async () => {
      const { token: token1 } = await createTestUser({ email: 'chat-user1@example.com' });
      const { token: token2 } = await createTestUser({ email: 'chat-user2@example.com' });

      // User 1 creates a session
      await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: 'User1 Session' });

      // User 2 should see no sessions
      const res = await request
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should order by most recent', async () => {
      const { token } = await createTestUser();

      await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Older Session' });

      // Small delay to ensure different updatedAt
      await new Promise((r) => setTimeout(r, 50));

      await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Newer Session' });

      const res = await request
        .get('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Most recent first (ordered by updatedAt desc)
      expect(res.body[0].title).toBe('Newer Session');
      expect(res.body[1].title).toBe('Older Session');
    });
  });

  // ===== Get Session by ID =====
  describe('GET /api/chat/sessions/:id', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.get('/api/chat/sessions/some-id');
      expect(res.status).toBe(401);
    });

    it('should return session with messages', async () => {
      const { token } = await createTestUser();

      const createRes = await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Detail Session' });

      const sessionId = createRes.body.id;

      const res = await request
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sessionId);
      expect(res.body.title).toBe('Detail Session');
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/chat/sessions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should not return other users sessions', async () => {
      const { token: token1 } = await createTestUser({ email: 'owner@example.com' });
      const { token: token2 } = await createTestUser({ email: 'other@example.com' });

      const createRes = await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: 'Private Session' });

      const sessionId = createRes.body.id;

      // Other user tries to access
      const res = await request
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(404);
    });
  });

  // ===== Delete Session =====
  describe('DELETE /api/chat/sessions/:id', () => {
    it('should return 401 without auth token', async () => {
      const res = await request.delete('/api/chat/sessions/some-id');
      expect(res.status).toBe(401);
    });

    it('should delete a session', async () => {
      const { token } = await createTestUser();

      const createRes = await request
        .post('/api/chat/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To Delete' });

      const sessionId = createRes.body.id;

      const deleteRes = await request
        .delete(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe('Session deleted');

      // Verify it's gone
      const getRes = await request
        .get(`/api/chat/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const { token } = await createTestUser();

      const res = await request
        .delete('/api/chat/sessions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
