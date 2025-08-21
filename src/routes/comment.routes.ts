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
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticateToken, createComment);
router.put("/:id", authenticateToken, updateComment);
router.delete("/:id", authenticateToken, deleteComment);
router.get("/", getComments);
router.get("/search", searchComments);

// Comment replies
router.post("/:commentId/replies", authenticateToken, createReply);
router.get("/:commentId/replies", getCommentReplies);

// Comment likes
router.post("/:commentId/like", authenticateToken, toggleCommentLike);

export default router;