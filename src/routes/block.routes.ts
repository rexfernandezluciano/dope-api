
import { Router } from 'express';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post('/', requireAuth, asyncHandler(blockUser));
router.delete('/:blockedUserId', requireAuth, asyncHandler(unblockUser));
router.get('/', requireAuth, asyncHandler(getBlockedUsers));

export default router;
