/** @format */

import { Router } from "express";
import {
	createComment,
	updateComment,
	deleteComment,
	getComments,
	searchComments,
} from "../controllers/comment.controller";
import { createReply, getCommentReplies } from "../controllers/reply.controller";
import { toggleCommentLike } from "../controllers/like.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createComment);
router.put("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);
router.get("/", getComments);
router.get("/search", searchComments);

// Comment replies
router.post("/:commentId/replies", requireAuth, createReply);
router.get("/:commentId/replies", getCommentReplies);

// Comment likes
router.post("/:commentId/like", requireAuth, toggleCommentLike);

export default router;