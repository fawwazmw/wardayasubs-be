import { Router } from 'express';
import {
  createSubscription,
  getSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  bulkDeleteSubscriptions,
  importSubscriptions,
  exportAllData,
  importAllData,
  getSubscriptionStats,
  getUpcomingRenewals,
} from '../controllers/subscriptionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, amount, billingCycle, nextBillingDate]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 example: 9.99
 *               currency:
 *                 type: string
 *                 default: USD
 *               billingCycle:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly, yearly]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               nextBillingDate:
 *                 type: string
 *                 format: date-time
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               website:
 *                 type: string
 *                 format: uri
 *               logo:
 *                 type: string
 *                 format: uri
 *               reminderDays:
 *                 type: integer
 *                 default: 3
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subscription created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Validation error
 */
router.post('/', createSubscription);

/**
 * @swagger
 * /api/subscriptions/bulk-delete:
 *   post:
 *     summary: Delete multiple subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Subscriptions deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *       403:
 *         description: Some IDs do not belong to user
 */
router.post('/bulk-delete', bulkDeleteSubscriptions);

/**
 * @swagger
 * /api/subscriptions/import:
 *   post:
 *     summary: Import subscriptions from CSV data
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptions]
 *             properties:
 *               subscriptions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, amount, billingCycle, nextBillingDate]
 *                   properties:
 *                     name:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                       default: USD
 *                     billingCycle:
 *                       type: string
 *                       enum: [weekly, monthly, quarterly, yearly]
 *                     nextBillingDate:
 *                       type: string
 *                     categoryName:
 *                       type: string
 *                       description: Auto-creates category if not found
 *                     isActive:
 *                       type: boolean
 *                       default: true
 *                     notes:
 *                       type: string
 *     responses:
 *       200:
 *         description: Import results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 imported:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/import', importSubscriptions);

/**
 * @swagger
 * /api/subscriptions/export-all:
 *   get:
 *     summary: Export all user data (subscriptions, categories, payments)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full data export
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0"
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/export-all', exportAllData);

/**
 * @swagger
 * /api/subscriptions/import-all:
 *   post:
 *     summary: Import full data backup (subscriptions + categories)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptions, categories]
 *             properties:
 *               subscriptions:
 *                 type: array
 *                 items:
 *                   type: object
 *               categories:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Import results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 imported:
 *                   type: object
 *                   properties:
 *                     subscriptions:
 *                       type: integer
 *                     categories:
 *                       type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/import-all', importAllData);

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: List all subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter by active status
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscription'
 */
router.get('/', getSubscriptions);

/**
 * @swagger
 * /api/subscriptions/stats:
 *   get:
 *     summary: Get subscription analytics/statistics
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSubscriptions:
 *                   type: integer
 *                 monthlyTotal:
 *                   type: number
 *                 yearlyTotal:
 *                   type: number
 *                 upcomingRenewals:
 *                   type: integer
 *                 byCategory:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       count:
 *                         type: integer
 *                       total:
 *                         type: number
 */
router.get('/stats', getSubscriptionStats);

/**
 * @swagger
 * /api/subscriptions/upcoming:
 *   get:
 *     summary: Get upcoming subscription renewals
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead
 *     responses:
 *       200:
 *         description: Upcoming renewals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   nextBillingDate:
 *                     type: string
 *                     format: date-time
 *                   daysUntilBilling:
 *                     type: integer
 */
router.get('/upcoming', getUpcomingRenewals);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   get:
 *     summary: Get a single subscription by ID
 *     tags: [Subscriptions]
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
 *         description: Subscription with category and recent payments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Not found
 */
router.get('/:id', getSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   put:
 *     summary: Update a subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly, yearly]
 *               nextBillingDate:
 *                 type: string
 *                 format: date-time
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               isActive:
 *                 type: boolean
 *               reminderDays:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Not found
 */
router.put('/:id', updateSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   delete:
 *     summary: Delete a subscription
 *     tags: [Subscriptions]
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
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */
router.delete('/:id', deleteSubscription);

export default router;
