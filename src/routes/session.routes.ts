
import { Router } from 'express';
import {
  getUserSessions,
  deleteUserSession,
  deleteAllUserSessions,
  deactivateUserSession,
} from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: Session management endpoints
 */

/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: Get user sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user sessions
 *   delete:
 *     summary: Delete all user sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions deleted
 */
router.get('/', requireAuth, getUserSessions);
router.delete('/', requireAuth, deleteAllUserSessions);

/**
 * @swagger
 * /sessions/{sessionId}:
 *   delete:
 *     summary: Delete a specific session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted successfully
 */
router.delete('/:sessionId', requireAuth, deleteUserSession);

/**
 * @swagger
 * /sessions/{sessionId}/deactivate:
 *   patch:
 *     summary: Deactivate a session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deactivated successfully
 */
router.patch('/:sessionId/deactivate', requireAuth, deactivateUserSession);

export default router;
