
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

// GET comments for a post
export const getComments = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;

		const post = await prisma.post.findUnique({
			where: { id: postId },
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const comments = await prisma.comment.findMany({
			where: { postId },
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
				createdAt: "desc",
			},
		});

		res.json(comments);
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
