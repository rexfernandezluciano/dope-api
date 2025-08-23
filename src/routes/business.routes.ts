
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

router.post("/campaigns", requireAuth, asyncHandler(createAdCampaign));
router.get("/campaigns", requireAuth, asyncHandler(getAdCampaigns));
router.put("/campaigns/:id", requireAuth, asyncHandler(updateAdCampaign));
router.post("/track", asyncHandler(trackAdInteraction));
router.get("/campaigns/:campaignId/analytics", requireAuth, asyncHandler(getAdAnalytics));
router.get("/dashboard", requireAuth, asyncHandler(getBusinessDashboard));

export default router;
