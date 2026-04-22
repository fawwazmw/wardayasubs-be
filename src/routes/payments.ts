import { Router } from 'express';
import { getPayments, createPayment, deletePayment } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by subscription
 *     responses:
 *       200:
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Payment'
 */
router.get('/', authenticate, getPayments);

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Record a new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId, amount]
 *             properties:
 *               subscriptionId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 example: 9.99
 *               currency:
 *                 type: string
 *                 default: USD
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 description: Defaults to now
 *     responses:
 *       201:
 *         description: Payment recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Subscription not found or not owned by user
 */
router.post('/', authenticate, createPayment);

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete a payment record
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticate, deletePayment);

export default router;
