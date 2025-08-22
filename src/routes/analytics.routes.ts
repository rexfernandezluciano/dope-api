
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
	getUserAnalytics,
	getPostAnalytics,
	getPlatformAnalytics,
} from "../controllers/analytics.controller";

const router = Router();

router.get("/user", requireAuth, getUserAnalytics);
router.get("/post/:postId", requireAuth, getPostAnalytics);
router.get("/platform", requireAuth, getPlatformAnalytics);

export default router;
