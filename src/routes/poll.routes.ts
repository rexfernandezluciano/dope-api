
import { Router } from "express";
import { votePoll, getPollResults, getUserVote } from "../controllers/poll.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// Vote on a poll (authenticated users only)
router.post("/:pollId/vote", requireAuth, asyncHandler(votePoll));

// Get poll results
router.get("/:pollId/results", asyncHandler(getPollResults));

// Get user's vote on a poll (authenticated users only)
router.get("/:pollId/user-vote", requireAuth, asyncHandler(getUserVote));

export default router;
/**
 * @swagger
 * tags:
 *   name: Polls
 *   description: Poll voting and management
 */

/**
 * @swagger
 * /api/polls/{pollId}/vote:
 *   post:
 *     summary: Vote on a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - optionIds
 *             properties:
 *               optionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of option IDs to vote for
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Vote recorded successfully
 *       400:
 *         description: Invalid vote data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/polls/{pollId}/user-vote:
 *   get:
 *     summary: Get user's vote status for a poll
 *     tags: [Polls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     responses:
 *       200:
 *         description: User vote status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasVoted:
 *                   type: boolean
 *                 votes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       optionId:
 *                         type: string
 *                       optionText:
 *                         type: string
 *                       votedAt:
 *                         type: string
 *                         format: date-time
 */

/**
 * @swagger
 * /api/polls/{pollId}/results:
 *   get:
 *     summary: Get poll results
 *     tags: [Polls]
 *     parameters:
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *         description: Poll ID
 *     responses:
 *       200:
 *         description: Poll results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Poll'
 */
