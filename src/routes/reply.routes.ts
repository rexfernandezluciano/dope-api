
import { Router } from 'express';
import { 
  getCommentReplies, 
  createCommentReply, 
  updateCommentReply, 
  deleteCommentReply 
} from '../controllers/reply.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Replies
 *   description: Comment reply management
 */

/**
 * @swagger
 * /replies/comment/{commentId}:
 *   get:
 *     summary: Get replies for a comment
 *     tags: [Replies]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of replies
 *   post:
 *     summary: Create a reply to a comment
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reply created successfully
 */
router.get('/comment/:commentId', optionalAuth, getCommentReplies);
router.post('/comment/:commentId', requireAuth, createCommentReply);

/**
 * @swagger
 * /replies/{replyId}:
 *   put:
 *     summary: Update a reply
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply updated successfully
 *   delete:
 *     summary: Delete a reply
 *     tags: [Replies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reply deleted successfully
 */
router.put('/:replyId', requireAuth, updateCommentReply);
router.delete('/:replyId', requireAuth, deleteCommentReply);

export default router;
