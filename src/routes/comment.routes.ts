/** @format */

import { Router } from "express";
import {
	createComment,
	updateComment,
	deleteComment,
	getComments,
	searchComments,
} from "../controllers/comment.controller";
import { toggleCommentLike, getCommentLikes } from "../controllers/like.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { optionalAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post("/", requireAuth, createComment);
router.put("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);
router.get("/", getComments);
router.get("/post/:postId", getComments);
router.get("/search", searchComments);

// Comment likes
router.post("/:id/like", requireAuth, asyncHandler(toggleCommentLike));
router.get("/:commentId/likes", optionalAuth, asyncHandler(getCommentLikes));

export default router;