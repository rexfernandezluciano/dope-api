
import { Request, Response } from "express";
import { connect } from "../database/database";
import { z } from "zod";
import type { User } from '../types/types.user';

let prisma: any;

(async () => {
	prisma = await connect();
})();

const VotePollSchema = z.object({
	optionIds: z.array(z.string()).min(1).max(10)
});

// Vote on a poll
export const votePoll = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as User;
		const { pollId } = req.params;
		const { optionIds } = VotePollSchema.parse(req.body);

		if (!pollId) {
			return res.status(400).json({ message: "Poll ID is required" });
		}

		// Check if poll exists and is not expired
		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			include: { 
				options: true,
				post: {
					select: { privacy: true }
				}
			}
		});

		if (!poll) {
			return res.status(404).json({ message: "Poll not found" });
		}

		if (poll.expiresAt && poll.expiresAt < new Date()) {
			return res.status(400).json({ message: "Poll has expired" });
		}

		// Check if user already voted
		const existingVote = await prisma.pollVote.findFirst({
			where: {
				pollId: pollId,
				userId: authUser.uid
			}
		});

		if (existingVote && !poll.allowMultiple) {
			return res.status(400).json({ message: "You have already voted on this poll" });
		}

		// Validate option IDs belong to this poll
		const validOptions = poll.options.filter(option => optionIds.includes(option.id));
		if (validOptions.length !== optionIds.length) {
			return res.status(400).json({ message: "Invalid option IDs" });
		}

		// If poll doesn't allow multiple choices, ensure only one option is selected
		if (!poll.allowMultiple && optionIds.length > 1) {
			return res.status(400).json({ message: "This poll only allows single choice" });
		}

		// Remove existing votes if updating
		if (existingVote) {
			await prisma.pollVote.deleteMany({
				where: {
					pollId: pollId,
					userId: authUser.uid
				}
			});
		}

		// Create new votes
		const votes = await Promise.all(optionIds.map(optionId =>
			prisma.pollVote.create({
				data: {
					pollId: pollId,
					optionId: optionId,
					userId: authUser.uid
				}
			})
		));

		res.json({
			message: "Vote recorded successfully",
			votes: votes
		});
	} catch (error) {
		console.error("Error voting on poll:", error);
		res.status(500).json({ error: "Failed to vote on poll" });
	}
};

// Get poll results
export const getPollResults = async (req: Request, res: Response) => {
	try {
		const { pollId } = req.params;

		if (!pollId) {
			return res.status(400).json({ message: "Poll ID is required" });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			include: {
				options: {
					include: {
						_count: {
							select: { votes: true }
						}
					}
				},
				_count: {
					select: { votes: true }
				}
			}
		});

		if (!poll) {
			return res.status(404).json({ message: "Poll not found" });
		}

		const totalVotes = poll._count.votes;
		const results = poll.options.map(option => ({
			id: option.id,
			text: option.text,
			position: option.position,
			votes: option._count.votes,
			percentage: totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0
		}));

		res.json({
			poll: {
				id: poll.id,
				question: poll.question,
				expiresAt: poll.expiresAt,
				allowMultiple: poll.allowMultiple,
				totalVotes: totalVotes,
				isExpired: poll.expiresAt ? poll.expiresAt < new Date() : false
			},
			results: results
		});
	} catch (error) {
		console.error("Error getting poll results:", error);
		res.status(500).json({ error: "Failed to get poll results" });
	}
};

// Get user's vote on a poll
export const getUserVote = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as User;
		const { pollId } = req.params;

		if (!pollId) {
			return res.status(400).json({ message: "Poll ID is required" });
		}

		const votes = await prisma.pollVote.findMany({
			where: {
				pollId: pollId,
				userId: authUser.uid
			},
			include: {
				option: true
			}
		});

		res.json({
			hasVoted: votes.length > 0,
			votes: votes.map(vote => ({
				optionId: vote.optionId,
				optionText: vote.option.text,
				votedAt: vote.createdAt
			}))
		});
	} catch (error) {
		console.error("Error getting user vote:", error);
		res.status(500).json({ error: "Failed to get user vote" });
	}
};
