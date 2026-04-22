import { describe, it, expect } from 'vitest';
import { request, createTestUser } from './helpers';
import prisma from '../lib/prisma';

describe('Notification Endpoints', () => {
  // --- List ---
  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      const { token, user } = await createTestUser();

      // Create test notifications
      await prisma.notification.createMany({
        data: [
          { message: 'Notif 1', userId: user.id },
          { message: 'Notif 2', userId: user.id },
        ],
      });

      const res = await request
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should not return other users notifications', async () => {
      const { user: user1 } = await createTestUser({ email: 'notif1@example.com' });
      const { token: token2 } = await createTestUser({ email: 'notif2@example.com' });

      await prisma.notification.create({
        data: { message: 'Private', userId: user1.id },
      });

      const res = await request
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // --- Mark as Read ---
  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const { token, user } = await createTestUser();
      const notif = await prisma.notification.create({
        data: { message: 'Unread', userId: user.id, read: false },
      });

      const res = await request
        .put(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      const { token } = await createTestUser();

      const res = await request
        .put('/api/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // --- Mark All Read ---
  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const { token, user } = await createTestUser();

      await prisma.notification.createMany({
        data: [
          { message: 'A', userId: user.id, read: false },
          { message: 'B', userId: user.id, read: false },
        ],
      });

      const res = await request
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify all are read
      const listRes = await request
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      const unread = listRes.body.filter((n: any) => !n.read);
      expect(unread).toHaveLength(0);
    });
  });
});
