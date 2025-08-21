import { Router } from 'express';
import { getUserSessions, revokeSession, revokeAllSessions, validateSession } from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, getUserSessions);
router.get('/validate', requireAuth, validateSession);
router.delete('/:sessionId', requireAuth, revokeSession);
router.delete('/', requireAuth, revokeAllSessions);

export default router;