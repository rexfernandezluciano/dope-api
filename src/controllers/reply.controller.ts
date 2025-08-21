
import { Request, Response } from "express";
import { connect } from "../database/database";
import { z } from "zod";

let prisma: any;

(async () => {
	prisma = await connect();
})();

const CreateReplySchema = z.object({
	content: z.string().min(1).max(500),
});

const UpdateReplySchema = z.object({
	content: z.string().min(1).max(500),
});

// GET replies for a comment
export const getCommentReplies = async (req: Request, res: Response) => {
	try {
		const { commentId } = req.params;
		const { limit = "20", cursor, sortBy = "desc" } = req.query;

		if (!commentId) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		const comment = await prisma.comment.findUnique({
			where: { id: commentId },
		});

		if (!comment) {
			return res.status(404).json({ message: "Comment not found" });
		}

		const limitNum = Math.min(parseInt(limit as string), 100);

		const where: any = { parentId: commentId };

		if (cursor) {
			if (sortBy === "asc") {
				where.id = { gt: cursor as string };
			} else {
				where.id = { lt: cursor as string };
			}
		}

		const replies = await prisma.comment.findMany({
			where,
			take: limitNum + 1,
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
				likes: {
					include: {
						user: {
							select: {
								uid: true,
								username: true,
							},
						},
					},
				},
				_count: {
					select: {
						likes: true,
						replies: true,
					},
				},
			},
			orderBy: {
				createdAt: sortBy === "asc" ? "asc" : "desc",
			},
		});

		const hasMore = replies.length > limitNum;
		const repliesToReturn = hasMore ? replies.slice(0, limitNum) : replies;
		const nextCursor = hasMore ? repliesToReturn[repliesToReturn.length - 1]?.id : null;

		res.json({
			replies: repliesToReturn.map((reply: any) => ({
				id: reply.id,
				content: reply.content,
				createdAt: reply.createdAt,
				updatedAt: reply.updatedAt,
				author: reply.author,
				likes: reply.likes.map((like: any) => ({
					user: {
						uid: like.user.uid,
						username: like.user.username,
					},
				})),
				stats: {
					likes: reply._count.likes,
					replies: reply._count.replies,
				},
			})),
			nextCursor,
			hasMore,
			limit: limitNum,
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching replies" });
	}
};

// CREATE reply to comment
export const createCommentReply = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { commentId } = req.params;
		const { content } = CreateReplySchema.parse(req.body);

		if (!commentId) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		const parentComment = await prisma.comment.findUnique({
			where: { id: commentId },
		});

		if (!parentComment) {
			return res.status(404).json({ message: "Comment not found" });
		}

		const reply = await prisma.comment.create({
			data: {
				content,
				postId: parentComment.postId,
				parentId: commentId,
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
				_count: {
					select: {
						likes: true,
						replies: true,
					},
				},
			},
		});

		res.status(201).json(reply);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error creating reply" });
	}
};

// UPDATE reply
export const updateCommentReply = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { replyId } = req.params;
		const { content } = UpdateReplySchema.parse(req.body);

		if (!replyId) {
			return res.status(400).json({ message: "Reply ID is required" });
		}

		const existingReply = await prisma.comment.findUnique({
			where: { id: replyId },
		});

		if (!existingReply) {
			return res.status(404).json({ message: "Reply not found" });
		}

		if (existingReply.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to update this reply" });
		}

		const reply = await prisma.comment.update({
			where: { id: replyId },
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

		res.json(reply);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error updating reply" });
	}
};

// DELETE reply
export const deleteCommentReply = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { replyId } = req.params;

		if (!replyId) {
			return res.status(400).json({ message: "Reply ID is required" });
		}

		const existingReply = await prisma.comment.findUnique({
			where: { id: replyId },
		});

		if (!existingReply) {
			return res.status(404).json({ message: "Reply not found" });
		}

		if (existingReply.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to delete this reply" });
		}

		await prisma.comment.delete({
			where: { id: replyId },
		});

		res.json({ message: "Reply deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: "Error deleting reply" });
	}
};
