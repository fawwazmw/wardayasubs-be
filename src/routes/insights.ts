import { Router } from 'express';
import {
  getForecast,
  getComparison,
  getScore,
  getCurrencyConversion,
} from '../controllers/insightsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/insights/forecast:
 *   get:
 *     summary: Get spending forecast for next 1, 3, 6, 12 months
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Spending forecast
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthly:
 *                   type: number
 *                   description: Projected monthly spending
 *                 threeMonth:
 *                   type: number
 *                   description: Projected 3-month spending
 *                 sixMonth:
 *                   type: number
 *                   description: Projected 6-month spending
 *                 yearly:
 *                   type: number
 *                   description: Projected yearly spending
 *                 byMonth:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         example: "2024-05"
 *                       amount:
 *                         type: number
 */
router.get('/forecast', getForecast);

/**
 * @swagger
 * /api/insights/comparison:
 *   get:
 *     summary: Get annual vs monthly cost comparison for each subscription
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing cycle comparison
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       currentAmount:
 *                         type: number
 *                       currentCycle:
 *                         type: string
 *                       monthlyEquivalent:
 *                         type: number
 *                       yearlyEquivalent:
 *                         type: number
 *                       potentialSavings:
 *                         type: number
 *                         description: Estimated 15-20% savings if switching to annual
 */
router.get('/comparison', getComparison);

/**
 * @swagger
 * /api/insights/score:
 *   get:
 *     summary: Get subscription value scores with AI-generated alternatives
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription scores and alternatives
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       usageRating:
 *                         type: integer
 *                         nullable: true
 *                       score:
 *                         type: number
 *                         nullable: true
 *                         description: Value score from 1-100
 *                       verdict:
 *                         type: string
 *                         enum: [great value, good, consider canceling, not rated]
 *                       alternatives:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             price:
 *                               type: string
 *                             description:
 *                               type: string
 */
router.get('/score', getScore);

/**
 * @swagger
 * /api/insights/currency:
 *   get:
 *     summary: Get all subscription amounts converted to a base currency
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *           default: USD
 *         description: Target base currency code (e.g. USD, EUR, GBP)
 *     responses:
 *       200:
 *         description: Currency-converted subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 baseCurrency:
 *                   type: string
 *                 subscriptions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       originalAmount:
 *                         type: number
 *                       originalCurrency:
 *                         type: string
 *                       convertedAmount:
 *                         type: number
 *                       convertedCurrency:
 *                         type: string
 *                       billingCycle:
 *                         type: string
 *                 totalMonthly:
 *                   type: number
 *                 rates:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 */
router.get('/currency', getCurrencyConversion);

export default router;
