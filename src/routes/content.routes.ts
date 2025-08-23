
import { Router, Request, Response } from 'express';
import { moderatePost } from '../controllers/content.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Content moderation endpoints
 */

/**
 * @swagger
 * /content/moderate:
 *   post:
 *     summary: Moderate post content
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               postId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Content moderation result
 */
router.post('/moderate', requireAuth, asyncHandler(moderatePost));

/**
 * @swagger
 * /content/check-image:
 *   post:
 *     summary: Check image for inappropriate content
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Image safety check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 safe:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *                 confidence:
 *                   type: number
 */
router.post('/check-image', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const { moderateImage } = await import('../controllers/content.controller');
    const result = await moderateImage(imageUrl);
    
    res.json({
      safe: result.isAppropriate,
      reason: result.reason || null,
      confidence: result.confidence || null
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Image check failed: ' + error.message });
  }
}));

export default router;
