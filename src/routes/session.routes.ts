
import { Router } from 'express';
import {
  getUserSessions,
  deleteUserSession,
  deleteAllUserSessions,
} from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getUserSessions);
router.delete('/:sessionId', requireAuth, deleteUserSession);
router.delete('/', requireAuth, deleteAllUserSessions);

export default router;
