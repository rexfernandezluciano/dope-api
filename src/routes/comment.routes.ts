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

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Comment management endpoints
 */

/**
 * @swagger
 * /comments:
 *   post:
 *     summary: Create a new comment with optional tip or donation
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               postId:
 *                 type: string
 *               content:
 *                 type: string
 *               tipAmount:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 500000
 *                 description: Tip amount in centavos (₱1-₱5000)
 *               donationAmount:
 *                 type: number
 *                 minimum: 500
 *                 maximum: 1000000
 *                 description: Donation amount in centavos (₱5-₱10000)
 *               paymentMethodId:
 *                 type: string
 *                 description: Required if tipAmount or donationAmount is provided
 *               stickerId:
 *                 type: string
 *                 description: Optional custom sticker for tips
 *               isAnonymous:
 *                 type: boolean
 *                 description: For donations only
 *     responses:
 *       201:
 *         description: Comment created successfully with optional payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 */
router.post("/", requireAuth, createComment);

/**
 * @swagger
 * /comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 */
router.put("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);

/**
 * @swagger
 * /comments:
 *   get:
 *     summary: Get comments
 *     tags: [Comments]
 *     responses:
 *       200:
 *         description: List of comments
 */
router.get("/", getComments);

/**
 * @swagger
 * /comments/post/{postId}:
 *   get:
 *     summary: Get comments for a specific post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments for the post
 *   post:
 *     summary: Create a comment on a specific post with optional tip or donation
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               tipAmount:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 500000
 *               donationAmount:
 *                 type: number
 *                 minimum: 500
 *                 maximum: 1000000
 *               paymentMethodId:
 *                 type: string
 *               stickerId:
 *                 type: string
 *               isAnonymous:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Comment created with optional payment
 */
router.get("/post/:postId", getComments);
router.post("/post/:postId", requireAuth, createComment);

/**
 * @swagger
 * /comments/search:
 *   get:
 *     summary: Search comments
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/search", searchComments);

/**
 * @swagger
 * /comments/{id}/like:
 *   post:
 *     summary: Like or unlike a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Like status toggled
 */
router.post("/:id/like", requireAuth, asyncHandler(toggleCommentLike));

/**
 * @swagger
 * /comments/{commentId}/likes:
 *   get:
 *     summary: Get likes for a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of likes
 */
router.get("/:commentId/likes", optionalAuth, asyncHandler(getCommentLikes));

export default router;