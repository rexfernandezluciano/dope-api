/** @format */

import { Router } from "express";
import {
	getComments,
	createComment,
	updateComment,
	deleteComment,
	searchComments,
} from "../controllers/comment.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/search", searchComments);
router.get("/post/:postId", getComments);

// Authenticated routes
router.post("/post/:postId", requireAuth, createComment);
router.put("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);

export default router;
