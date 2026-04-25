import { describe, it, expect } from 'vitest';
import { request, createTestUser } from './helpers';

describe('Auth Endpoints', () => {
  // --- Register ---
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Account created');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'dup@example.com' });

      const res = await request.post('/api/auth/register').send({
        email: 'dup@example.com',
        password: 'Password123',
        name: 'Dup User',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject short password', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'short@example.com',
        password: '123',
        name: 'Short Pass',
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request.post('/api/auth/register').send({
        email: 'missing@example.com',
      });

      expect(res.status).toBe(400);
    });
  });

  // --- Login ---
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { user, plainPassword } = await createTestUser({ email: 'login@example.com' });

      const res = await request.post('/api/auth/login').send({
        email: 'login@example.com',
        password: plainPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('should reject wrong password', async () => {
      await createTestUser({ email: 'wrongpw@example.com' });

      const res = await request.post('/api/auth/login').send({
        email: 'wrongpw@example.com',
        password: 'WrongPassword1',
      });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request.post('/api/auth/login').send({
        email: 'noone@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(401);
    });

    it('should reject unverified email', async () => {
      const { plainPassword } = await createTestUser({
        email: 'unverified@example.com',
        emailVerified: false,
      });

      const res = await request.post('/api/auth/login').send({
        email: 'unverified@example.com',
        password: plainPassword,
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  // --- Profile ---
  describe('GET /api/auth/profile', () => {
    it('should return profile for authenticated user', async () => {
      const { token, user } = await createTestUser();

      const res = await request
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(user.email);
      expect(res.body.name).toBe(user.name);
      expect(res.body.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const res = await request.get('/api/auth/profile');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  // --- Update Profile ---
  describe('PUT /api/auth/profile', () => {
    it('should update name and currency', async () => {
      const { token } = await createTestUser();

      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', currency: 'EUR' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.currency).toBe('EUR');
    });

    it('should change password with correct current password', async () => {
      const { token, plainPassword } = await createTestUser({ email: 'changepw@example.com' });

      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: plainPassword, newPassword: 'NewPassword123' });

      expect(res.status).toBe(200);

      // Verify new password works
      const loginRes = await request.post('/api/auth/login').send({
        email: 'changepw@example.com',
        password: 'NewPassword123',
      });
      expect(loginRes.status).toBe(200);
    });

    it('should reject password change with wrong current password', async () => {
      const { token } = await createTestUser();

      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword123' });

      expect(res.status).toBe(400);
    });
  });
});
