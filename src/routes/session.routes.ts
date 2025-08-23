
import { Router } from 'express';
import {
  getUserSessions,
  deleteUserSession,
  deleteAllUserSessions,
  deactivateUserSession,
} from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getUserSessions);
router.delete('/:sessionId', requireAuth, deleteUserSession);
router.patch('/:sessionId/deactivate', requireAuth, deactivateUserSession);
router.delete('/', requireAuth, deleteAllUserSessions);

export default router;
