/** @format */

import { Router } from "express";
import {
	getPosts,
	getPost,
	createPost,
	updatePost,
	deletePost,
	toggleLike,
	getFollowingFeed,
	trackPostView,
	trackEarnings,
	updatePostEngagement,
} from "../controllers/post.controller";
import { requireAuth, authenticateJWT, optionalAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", optionalAuth, getPosts);
router.get("/feed/following", authenticateJWT, getFollowingFeed);
router.get("/:id", optionalAuth, getPost);
router.post("/:id/view", trackPostView);
router.post("/:id/earnings", trackEarnings);
router.post("/:id/engagement", updatePostEngagement);

// Authenticated routes
router.post("/", requireAuth, createPost);
router.put("/:id", requireAuth, updatePost);
router.delete("/:id", requireAuth, deletePost);
router.post("/:id/like", requireAuth, toggleLike);

export default router;