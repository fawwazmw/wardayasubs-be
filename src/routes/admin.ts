import { Router } from 'express';
import { getSystemStats, getAllUsers, deleteUser, requireAdmin } from '../controllers/adminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', getSystemStats);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

export default router;
