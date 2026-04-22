import { Router } from 'express';
import multer from 'multer';
import { getSessions, createSession, getSession, deleteSession, sendMessage, sendImage } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

// ===== Session Management =====

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: List all chat sessions
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions ordered by most recent
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   _count:
 *                     type: object
 *                     properties:
 *                       messages:
 *                         type: integer
 */
router.get('/sessions', getSessions);

/**
 * @swagger
 * /api/chat/sessions:
 *   post:
 *     summary: Create a new chat session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 default: New Chat
 *     responses:
 *       201:
 *         description: Session created
 */
router.post('/sessions', createSession);

/**
 * @swagger
 * /api/chat/sessions/{id}:
 *   get:
 *     summary: Get a session with all messages
 *     tags: [Chat]
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
 *         description: Session with messages
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:id', getSession);

/**
 * @swagger
 * /api/chat/sessions/{id}:
 *   delete:
 *     summary: Delete a chat session
 *     tags: [Chat]
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
 *         description: Session deleted
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:id', deleteSession);

// ===== Chat Messages (within a session) =====

/**
 * @swagger
 * /api/chat/sessions/{id}/message:
 *   post:
 *     summary: Send a text message in a session
 *     tags: [Chat]
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
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response
 */
router.post('/sessions/:id/message', sendMessage);

/**
 * @swagger
 * /api/chat/sessions/{id}/image:
 *   post:
 *     summary: Upload an image in a session for AI analysis
 *     tags: [Chat]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response with extracted details
 */
router.post('/sessions/:id/image', upload.single('image'), sendImage);

export default router;
