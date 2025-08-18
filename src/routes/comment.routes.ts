/** @format */

import { Router } from "express";
import {
	getComments,
	createComment,
	updateComment,
	deleteComment,
} from "../controllers/comment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { verifyAppCheck } from "../middleware/firebase.middleware";

const router = Router();

// Public routes
router.get("/post/:postId", getComments);

// Authenticated routes
router.post("/post/:postId", requireAuth, verifyAppCheck, createComment);
router.put("/:id", requireAuth, verifyAppCheck, updateComment);
router.delete("/:id", requireAuth, verifyAppCheck, deleteComment);

export default router;
