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
	getCurrentUserPosts,
	sharePost
} from "../controllers/post.controller";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";
import { togglePostLike, getPostLikes } from '../controllers/like.controller';

const router = Router();

// Public routes
router.get("/", optionalAuth, getPosts);
router.get("/feed/following", requireAuth, getFollowingFeed);
router.get("/:id", optionalAuth, getPost);
router.post("/:id/view", trackPostView);
router.post("/:id/earnings", trackEarnings);
router.post("/:id/engagement", updatePostEngagement);

// Authenticated routes
router.post("/", requireAuth, createPost);
router.put("/:id", requireAuth, updatePost);
router.delete("/:id", requireAuth, deletePost);
router.post("/:postId/like", requireAuth, togglePostLike);
router.get("/user/me", requireAuth, getCurrentUserPosts);

// Share post route
router.post('/share/:id', sharePost);

// Likes routes
router.get('/:postId/likes', optionalAuth, getPostLikes);

export default router;