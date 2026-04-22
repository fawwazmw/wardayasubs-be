import { Router } from 'express';
import { getSystemStats, getAllUsers, deleteUser, requireAdmin } from '../controllers/adminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin as any);

router.get('/stats', getSystemStats as any);
router.get('/users', getAllUsers as any);
router.delete('/users/:id', deleteUser as any);

export default router;
