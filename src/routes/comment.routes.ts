/** @format */

import { Router } from "express";
import {
	createComment,
	updateComment,
	deleteComment,
	getComments,
	searchComments,
} from "../controllers/comment.controller";
import { createCommentReply, getCommentReplies } from "../controllers/reply.controller";
import { toggleCommentLike, getCommentLikes } from "../controllers/like.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { optionalAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createComment);
router.put("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);
router.get("/", getComments);
router.get("/post/:postId", getComments);
router.get("/search", searchComments);

// Comment replies are handled in reply.routes.ts

// Comment likes
router.post("/:id/like", requireAuth, toggleCommentLike);
router.get("/:commentId/likes", optionalAuth, getCommentLikes);

export default router;