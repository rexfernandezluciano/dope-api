
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
	getUserRecommendations,
	getTrendingHashtags,
} from "../controllers/recommendation.controller";

const router = Router();

router.get("/", requireAuth, getUserRecommendations);
router.get("/trending", getTrendingHashtags);

export default router;
