import { Router } from 'express';
import { getUserSessions, revokeSession, revokeAllSessions, validateSession } from '../controllers/session.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getUserSessions);
router.get('/validate', authenticateToken, validateSession);
router.delete('/:sessionId', authenticateToken, revokeSession);
router.delete('/', authenticateToken, revokeAllSessions);

export default router;