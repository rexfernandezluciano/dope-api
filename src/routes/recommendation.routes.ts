
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
	getUserRecommendations,
	getTrendingHashtags,
} from "../controllers/recommendation.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Recommendations
 *   description: Content recommendation endpoints
 */

/**
 * @swagger
 * /recommendations:
 *   get:
 *     summary: Get user recommendations
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized recommendations
 */
router.get("/", requireAuth, getUserRecommendations);

/**
 * @swagger
 * /recommendations/trending:
 *   get:
 *     summary: Get trending hashtags
 *     tags: [Recommendations]
 *     responses:
 *       200:
 *         description: List of trending hashtags
 */
router.get("/trending", getTrendingHashtags);

export default router;
