
import { Router } from 'express';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateToken, blockUser);
router.delete('/:blockedUserId', authenticateToken, unblockUser);
router.get('/', authenticateToken, getBlockedUsers);

export default router;
