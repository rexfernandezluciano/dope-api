
import { Router } from 'express';
import { getUserSessions, revokeSession, revokeAllSessions } from '../controllers/session.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, getUserSessions);
router.delete('/:sessionId', authenticateJWT, revokeSession);
router.delete('/', authenticateJWT, revokeAllSessions);

export default router;
