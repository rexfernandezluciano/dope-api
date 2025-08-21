/** @format */

import { Request, Response } from "express";
import { connect } from "../database/database";
import { z } from "zod";

let prisma: any;

(async () => {
	prisma = await connect();
})();

const CreateCommentSchema = z.object({
	content: z.string().min(1).max(500),
});

const UpdateCommentSchema = z.object({
	content: z.string().min(1).max(500),
});

const SearchCommentsSchema = z.object({
	query: z.string().min(1).max(100),
	limit: z.string().optional(),
	cursor: z.string().optional(),
	author: z.string().optional(),
	postId: z.string().optional(),
	sortBy: z.enum(["desc", "asc"]).optional(),
});

// GET comments for a post with pagination and filtering
export const getComments = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;
		const {
			limit = "20",
			cursor,
			author,
			search,
			sortBy = "desc"
		} = req.query;

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 comments per request

		// Build where clause for filtering
		const where: any = { postId };

		if (author) {
			const authorUser = await prisma.user.findUnique({
				where: { username: author as string },
				select: { uid: true }
			});
			
			if (authorUser) {
				where.authorId = authorUser.uid;
			} else {
				return res.json({ comments: [], nextCursor: null, hasMore: false });
			}
		}

		if (search) {
			where.content = {
				contains: search as string,
				mode: "insensitive"
			};
		}

		// Add cursor pagination
		if (cursor) {
			if (sortBy === "asc") {
				where.id = { gt: cursor as string };
			} else {
				where.id = { lt: cursor as string };
			}
		}

		const comments = await prisma.comment.findMany({
			where,
			take: limitNum + 1, // Take one extra to check if there are more
			include: {
				author: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
					},
				},
			},
			orderBy: {
				createdAt: sortBy === "asc" ? "asc" : "desc",
			},
		});

		const hasMore = comments.length > limitNum;
		const commentsToReturn = hasMore ? comments.slice(0, limitNum) : comments;
		const nextCursor = hasMore ? commentsToReturn[commentsToReturn.length - 1]?.id : null;

		res.json({
			comments: commentsToReturn,
			nextCursor,
			hasMore,
			limit: limitNum,
			sortBy,
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching comments" });
	}
};

// CREATE comment (authenticated only)
export const createComment = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { postId } = req.params;
		const { content } = CreateCommentSchema.parse(req.body);

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const comment = await prisma.comment.create({
			data: {
				content,
				postId,
				authorId: authUser.uid,
			},
			include: {
				author: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
					},
				},
			},
		});

		res.status(201).json(comment);

		// Update post earnings based on new comment
		const postWithCounts = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				analytics: true,
				_count: {
					select: {
						likes: true,
						comments: true,
					},
				},
			},
		});

		if (postWithCounts) {
			// Calculate earnings based on engagement metrics
			const views = postWithCounts.analytics?.views || 0;
			const shares = postWithCounts.analytics?.shares || 0;
			const likes = postWithCounts._count?.likes || 0;
			const comments = postWithCounts._count?.comments || 0;

			const totalEngagement = views + (shares * 2) + (likes * 1.5) + (comments * 3);
			const newEarnings = totalEngagement >= 1000000 ? 0.01 : 0;

			await prisma.postAnalytics.update({
				where: { id: postId },
				data: { earnings: newEarnings },
			});
		}
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error creating comment" });
	}
};

// UPDATE comment (authenticated only, author only)
export const updateComment = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { id } = req.params;
		const { content } = UpdateCommentSchema.parse(req.body);

		if (!id) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		const existingComment = await prisma.comment.findUnique({
			where: { id },
		});

		if (!existingComment) {
			return res.status(404).json({ message: "Comment not found" });
		}

		if (existingComment.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to update this comment" });
		}

		const comment = await prisma.comment.update({
			where: { id },
			data: { content },
			include: {
				author: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
					},
				},
			},
		});

		res.json(comment);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error updating comment" });
	}
};

// SEARCH comments globally
export const searchComments = async (req: Request, res: Response) => {
	try {
		const {
			query,
			limit = "20",
			cursor,
			author,
			postId,
			sortBy = "desc"
		} = SearchCommentsSchema.parse(req.query);

		const limitNum = Math.min(parseInt(limit), 100); // Max 100 comments per request

		// Build where clause for filtering
		const where: any = {
			content: {
				contains: query,
				mode: "insensitive"
			}
		};

		// Filter by author if specified
		if (author) {
			const authorUser = await prisma.user.findUnique({
				where: { username: author },
				select: { uid: true }
			});
			
			if (authorUser) {
				where.authorId = authorUser.uid;
			} else {
				return res.json({ comments: [], nextCursor: null, hasMore: false });
			}
		}

		// Filter by post if specified
		if (postId) {
			where.postId = postId;
		}

		// Add cursor pagination
		if (cursor) {
			if (sortBy === "asc") {
				where.id = { gt: cursor };
			} else {
				where.id = { lt: cursor };
			}
		}

		const comments = await prisma.comment.findMany({
			where,
			take: limitNum + 1, // Take one extra to check if there are more
			include: {
				author: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
					},
				},
				post: {
					select: {
						id: true,
						content: true,
						postType: true,
						author: {
							select: {
								uid: true,
								name: true,
								username: true,
								photoURL: true,
								hasBlueCheck: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: sortBy === "asc" ? "asc" : "desc",
			},
		});

		const hasMore = comments.length > limitNum;
		const commentsToReturn = hasMore ? comments.slice(0, limitNum) : comments;
		const nextCursor = hasMore ? commentsToReturn[commentsToReturn.length - 1]?.id : null;

		res.json({
			comments: commentsToReturn,
			nextCursor,
			hasMore,
			limit: limitNum,
			sortBy,
			query,
		});
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid query parameters", errors: err.errors });
		}
		res.status(500).json({ error: "Error searching comments" });
	}
};

// DELETE comment (authenticated only, author only)
export const deleteComment = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { id } = req.params;

		if (!id) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		const existingComment = await prisma.comment.findUnique({
			where: { id },
		});

		if (!existingComment) {
			return res.status(404).json({ message: "Comment not found" });
		}

		if (existingComment.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to delete this comment" });
		}

		await prisma.comment.delete({
			where: { id },
		});

		res.json({ message: "Comment deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: "Error deleting comment" });
	}
};