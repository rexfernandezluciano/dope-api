
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
	getUserAnalytics,
	getPostAnalytics,
	getPlatformAnalytics,
} from "../controllers/analytics.controller";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Analytics and metrics endpoints
 */

/**
 * @swagger
 * /analytics/user:
 *   get:
 *     summary: Get user analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User analytics data
 */
router.get("/user", requireAuth, getUserAnalytics);

/**
 * @swagger
 * /analytics/post/{postId}:
 *   get:
 *     summary: Get post analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post analytics data
 */
router.get("/post/:postId", requireAuth, asyncHandler(getPostAnalytics));

/**
 * @swagger
 * /analytics/platform:
 *   get:
 *     summary: Get platform analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform analytics data
 */
router.get("/platform", requireAuth, asyncHandler(getPlatformAnalytics));

export default router;
