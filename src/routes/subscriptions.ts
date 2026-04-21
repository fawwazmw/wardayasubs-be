import { Router } from 'express';
import {
  createSubscription,
  getSubscriptions,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  bulkDeleteSubscriptions,
  importSubscriptions,
  getSubscriptionStats,
  getUpcomingRenewals,
} from '../controllers/subscriptionController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', createSubscription);
router.post('/bulk-delete', bulkDeleteSubscriptions);
router.post('/import', importSubscriptions);
router.get('/', getSubscriptions);
router.get('/stats', getSubscriptionStats);
router.get('/upcoming', getUpcomingRenewals);
router.get('/:id', getSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);

export default router;
