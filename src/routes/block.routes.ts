
import { Router } from 'express';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, blockUser);
router.delete('/:blockedUserId', requireAuth, unblockUser);
router.get('/', requireAuth, getBlockedUsers);

export default router;
