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
/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Post management and social interactions
 */

/**
 * @swagger
 * /v1/posts:
 *   get:
 *     summary: Get posts feed
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of posts per page
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *   post:
 *     summary: Create new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               imageUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               postType:
 *                 type: string
 *                 enum: [text, live_video, poll]
 *                 default: text
 *               privacy:
 *                 type: string
 *                 enum: [public, private, followers]
 *                 default: public
 *               poll:
 *                 type: object
 *                 properties:
 *                   question:
 *                     type: string
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *                   expiresAt:
 *                     type: string
 *                     format: date-time
 *                   allowMultiple:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 */

/**
 * @swagger
 * /v1/posts/{postId}:
 *   get:
 *     summary: Get single post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /v1/posts/{postId}/like:
 *   post:
 *     summary: Like a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post liked successfully
 */

