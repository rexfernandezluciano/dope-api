
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

const router = Router();

router.post("/campaigns", requireAuth, createAdCampaign);
router.get("/campaigns", requireAuth, getAdCampaigns);
router.put("/campaigns/:id", requireAuth, updateAdCampaign);
router.post("/track", trackAdInteraction);
router.get("/campaigns/:campaignId/analytics", requireAuth, getAdAnalytics);
router.get("/dashboard", requireAuth, getBusinessDashboard);

export default router;
