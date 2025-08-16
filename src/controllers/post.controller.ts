/** @format */

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const CreatePostSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	imageUrls: z.array(z.string().url()).max(10).optional(),
}).refine((data) => data.content || (data.imageUrls && data.imageUrls.length > 0), {
	message: "Either content or at least one image must be provided",
});

const UpdatePostSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	imageUrls: z.array(z.string().url()).max(10).optional(),
});

// GET all posts
export const getPosts = async (req: Request, res: Response) => {
	try {
		const posts = await prisma.post.findMany({
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
				comments: {
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
						comments: true,
						likes: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});
		res.json(posts);
	} catch (error) {
		res.status(500).json({ error: "Error fetching posts" });
	}
};

// GET single post
export const getPost = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Post ID is required" });
		}
		const post = await prisma.post.findUnique({
			where: { id },
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
				comments: {
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
						comments: true,
						likes: true,
					},
				},
			},
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		res.json(post);
	} catch (error) {
		res.status(500).json({ error: "Error fetching post" });
	}
};

// CREATE post (authenticated only)
export const createPost = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { content, imageUrls } = CreatePostSchema.parse(req.body);

		// Validate that either content or images are provided
		if (!content && (!imageUrls || imageUrls.length === 0)) {
			return res.status(400).json({ message: "Either content or images must be provided" });
		}

		const post = await prisma.post.create({
			data: {
				content: content || null,
				imageUrls: imageUrls || [],
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
						comments: true,
						likes: true,
					},
				},
			},
		});

		res.status(201).json(post);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error creating post" });
	}
};

// UPDATE post (authenticated only, author only)
export const updatePost = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { id } = req.params;
		const data = UpdatePostSchema.parse(req.body);

		if (!id) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const existingPost = await prisma.post.findUnique({
			where: { id },
		});

		if (!existingPost) {
			return res.status(404).json({ message: "Post not found" });
		}

		if (existingPost.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to update this post" });
		}

		// Filter out undefined values to match Prisma's exact optional property types
		const updateData: { content?: string | null; imageUrls?: string[] } = {};
		if (data.content !== undefined) updateData.content = data.content;
		if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;

		const post = await prisma.post.update({
			where: { id },
			data: updateData,
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
						comments: true,
						likes: true,
					},
				},
			},
		});

		res.json(post);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error updating post" });
	}
};

// DELETE post (authenticated only, author only)
export const deletePost = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const existingPost = await prisma.post.findUnique({
			where: { id },
		});

		if (!existingPost) {
			return res.status(404).json({ message: "Post not found" });
		}

		if (existingPost.authorId !== authUser.uid) {
			return res.status(403).json({ message: "Not authorized to delete this post" });
		}

		await prisma.post.delete({
			where: { id },
		});

		res.json({ message: "Post deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: "Error deleting post" });
	}
};

// LIKE/UNLIKE post (authenticated only)
export const toggleLike = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const post = await prisma.post.findUnique({
			where: { id },
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const existingLike = await prisma.like.findFirst({
			where: {
				postId: id,
				userId: authUser.uid,
			},
		});

		if (existingLike) {
			// Unlike
			await prisma.like.delete({
				where: { id: existingLike.id },
			});
			res.json({ message: "Post unliked", liked: false });
		} else {
			// Like
			await prisma.like.create({
				data: {
					postId: id,
					userId: authUser.uid,
				},
			});
			res.json({ message: "Post liked", liked: true });
		}
	} catch (error) {
		res.status(500).json({ error: "Error toggling like" });
	}
};