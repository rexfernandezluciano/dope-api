
import { Router, Request, Response } from 'express';
import { moderatePost } from '../controllers/content.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post('/moderate', requireAuth, asyncHandler(moderatePost));
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
