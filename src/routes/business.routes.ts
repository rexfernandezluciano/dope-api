
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
	createAdCampaign,
	getAdCampaigns,
	updateAdCampaign,
	trackAdInteraction,
	getAdAnalytics,
	getBusinessDashboard,
} from "../controllers/business.controller";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Business
 *   description: Business and advertising endpoints
 */

/**
 * @swagger
 * /business/campaigns:
 *   post:
 *     summary: Create ad campaign
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               budget:
 *                 type: number
 *               targetAudience:
 *                 type: object
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *   get:
 *     summary: Get ad campaigns
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of campaigns
 */
router.post("/campaigns", requireAuth, asyncHandler(createAdCampaign));
router.get("/campaigns", requireAuth, asyncHandler(getAdCampaigns));

/**
 * @swagger
 * /business/campaigns/{id}:
 *   put:
 *     summary: Update ad campaign
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 */
router.put("/campaigns/:id", requireAuth, asyncHandler(updateAdCampaign));

/**
 * @swagger
 * /business/track:
 *   post:
 *     summary: Track ad interaction
 *     tags: [Business]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               campaignId:
 *                 type: string
 *               interactionType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interaction tracked
 */
router.post("/track", asyncHandler(trackAdInteraction));

/**
 * @swagger
 * /business/campaigns/{campaignId}/analytics:
 *   get:
 *     summary: Get campaign analytics
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign analytics data
 */
router.get("/campaigns/:campaignId/analytics", requireAuth, asyncHandler(getAdAnalytics));

/**
 * @swagger
 * /business/dashboard:
 *   get:
 *     summary: Get business dashboard
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business dashboard data
 */
router.get("/dashboard", requireAuth, asyncHandler(getBusinessDashboard));

export default router;
