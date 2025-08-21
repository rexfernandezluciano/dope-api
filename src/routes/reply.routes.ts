
import { Router } from 'express';
import { 
  getCommentReplies, 
  createCommentReply, 
  updateCommentReply, 
  deleteCommentReply 
} from '../controllers/reply.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/comment/:commentId', optionalAuth, getCommentReplies);
router.post('/comment/:commentId', requireAuth, createCommentReply);
router.put('/:replyId', requireAuth, updateCommentReply);
router.delete('/:replyId', requireAuth, deleteCommentReply);

export default router;
