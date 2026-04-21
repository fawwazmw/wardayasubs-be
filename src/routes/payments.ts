import { Router } from 'express';
import { getPayments, createPayment, deletePayment } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getPayments);
router.post('/', authenticate, createPayment);
router.delete('/:id', authenticate, deletePayment);

export default router;
