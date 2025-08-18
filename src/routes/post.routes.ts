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
} from "../controllers/post.controller";
import { requireAuth, authenticateJWT, optionalAuth } from "../middleware/auth.middleware";
import { verifyAppCheck } from "../middleware/firebase.middleware";

const router = Router();

// Public routes
router.get("/", optionalAuth, getPosts);
router.get("/feed/following", authenticateJWT, getFollowingFeed);
router.get("/:id", optionalAuth, getPost);
router.post("/:id/view", trackPostView);

// Authenticated routes
router.post("/", requireAuth, verifyAppCheck, createPost);
router.put("/:id", requireAuth, verifyAppCheck, updatePost);
router.delete("/:id", requireAuth, verifyAppCheck, deletePost);
router.post("/:id/like", requireAuth, verifyAppCheck, toggleLike);

export default router;