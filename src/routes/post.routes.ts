
/** @format */

import { Router } from "express";
import {
	getPosts,
	getPost,
	createPost,
	updatePost,
	deletePost,
	toggleLike,
} from "../controllers/post.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", getPosts);
router.get("/:id", getPost);

// Authenticated routes
router.post("/", requireAuth, createPost);
router.put("/:id", requireAuth, updatePost);
router.delete("/:id", requireAuth, deletePost);
router.post("/:id/like", requireAuth, toggleLike);

export default router;
