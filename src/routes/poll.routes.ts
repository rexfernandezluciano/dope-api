
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
