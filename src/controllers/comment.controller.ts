
/** @format */

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const CreateCommentSchema = z.object({
	content: z.string().min(1).max(500),
});

const UpdateCommentSchema = z.object({
	content: z.string().min(1).max(500),
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
