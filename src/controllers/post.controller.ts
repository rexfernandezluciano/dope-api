/** @format */

import { Request, Response } from "express";
import { PrismaClient, User } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const CreatePostSchema = z
	.object({
		content: z.string().min(1).max(1000).optional(),
		imageUrls: z.array(z.string().url()).max(10).optional(),
		liveVideoUrl: z.string().url().optional(),
		postType: z.enum(["text", "live_video"]).default("text"),
		privacy: z.enum(["public", "private", "followers"]).default("public"),
	})
	.refine(
		(data) => {
			if (data.postType === "live_video") {
				return data.liveVideoUrl; // Live video posts must have a video URL
			}
			return data.content || (data.imageUrls && data.imageUrls.length > 0);
		},
		{
			message:
				"Text posts must have either content or at least one image. Live video posts must have a video URL.",
		},
	);

const UpdatePostSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	imageUrls: z.array(z.string().url()).max(10).optional(),
	liveVideoUrl: z.string().url().optional(),
	postType: z.enum(["text", "live_video"]).optional(),
	privacy: z.enum(["public", "private", "followers"]),
});

// GET all posts with pagination and filtering
export const getPosts = async (req: Request, res: Response) => {
	try {
		const {
			limit = "20",
			cursor,
			author,
			postType,
			hasImages,
			hasLiveVideo,
			search,
		} = req.query;

		const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 posts per request

		// Build where clause for filtering
		const where: any = {};

		if (author) {
			const authorUser = await prisma.user.findUnique({
				where: { username: author as string },
				select: { uid: true },
			});
			if (authorUser) {
				where.authorId = authorUser.uid;
			} else {
				return res.json({ posts: [], nextCursor: null, hasMore: false });
			}
		}

		if (postType && (postType === "text" || postType === "live_video")) {
			where.postType = postType;
		}

		if (hasImages === "true") {
			where.imageUrls = { isEmpty: false };
		} else if (hasImages === "false") {
			where.imageUrls = { isEmpty: true };
		}

		if (hasLiveVideo === "true") {
			where.liveVideoUrl = { not: null };
		} else if (hasLiveVideo === "false") {
			where.liveVideoUrl = null;
		}

		if (search) {
			where.content = {
				contains: search as string,
				mode: "insensitive",
			};
		}

		// Add cursor pagination
		if (cursor) {
			where.id = { lt: cursor as string };
		}

		const posts = await prisma.post.findMany({
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
				comments: {
					take: 3, // Only show first 3 comments in list view
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
			orderBy: {
				createdAt: "desc",
			},
		});

		const hasMore = posts.length > limitNum;
		const postsToReturn = hasMore ? posts.slice(0, limitNum) : posts;
		const nextCursor =
			hasMore && postsToReturn && postsToReturn.length > 0
				? postsToReturn[postsToReturn.length - 1]?.id
				: null;

		// Get current user's following list for isFollowedByCurrentUser check
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map(f => f.followingId);
		}

		const output = postsToReturn.map((p) => {
			return {
				id: p.id,
				content: p.content,
				imageUrls: p.imageUrls,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				stats: {
					comments: p._count.comments,
					likes: p._count.likes,
				},
				author: {
					...p.author,
					isFollowedByCurrentUser: authUser ? followingIds.includes(p.author.uid) : false,
				},
				comments: p.comments.map((c) => {
					return {
						id: c.id,
						content: c.content,
						createdAt: c.createdAt,
						author: {
							...c.author,
						},
					};
				}),
				likes: p.likes.map((l) => {
					return {
						user: {
							uid: l.user.uid,
							username: l.user.username,
						},
					};
				}),
				postType: p.postType,
				liveVideoUrl: p.liveVideoUrl,
				privacy: p.privacy,
			};
		});

		res.json({
			status: "ok",
			posts: output,
			nextCursor,
			hasMore,
			limit: limitNum,
		});
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

		// Check if current user follows the post author
		const authUser = (req as any).user as { uid: string } | undefined;
		let isFollowedByCurrentUser = false;
		if (authUser) {
			const follow = await prisma.follow.findFirst({
				where: {
					followerId: authUser.uid,
					followingId: post.author.uid,
				},
			});
			isFollowedByCurrentUser = !!follow;
		}

		const output = {
			id: post.id,
			content: post.content,
			imageUrls: post.imageUrls,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			stats: {
				comments: post._count.comments,
				likes: post._count.likes,
			},
			author: {
				...post.author,
				isFollowedByCurrentUser,
			},
			comments: post.comments.map((c) => {
				return {
					id: c.id,
					content: c.content,
					createdAt: c.createdAt,
					author: {
						...c.author,
					},
				};
			}),
			likes: post.likes.map((l) => {
				return {
					user: {
						uid: l.user.uid,
						username: l.user.username,
					},
				};
			}),
			postType: post.postType,
			liveVideoUrl: post.liveVideoUrl,
			privacy: post.privacy,
		};

		res.json({ status: "ok", post: output });
	} catch (error) {
		res.status(500).json({ error: "Error fetching post" });
	}
};

// CREATE post (authenticated only)
export const createPost = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { content, imageUrls, liveVideoUrl, postType, privacy } =
			CreatePostSchema.parse(req.body);

		const post = await prisma.post.create({
			data: {
				content: content || null,
				imageUrls: imageUrls || [],
				liveVideoUrl: liveVideoUrl || null,
				postType: postType || "text",
				authorId: authUser.uid,
				privacy: privacy || "public",
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
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
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
			return res
				.status(403)
				.json({ message: "Not authorized to update this post" });
		}

		// Filter out undefined values to match Prisma's exact optional property types
		const updateData: {
			content?: string | null;
			imageUrls?: string[];
			liveVideoUrl?: string | null;
			postType?: "text" | "live_video";
			privacy?: "public" | "private" | "followers";
		} = {};
		if (data.content !== undefined) updateData.content = data.content;
		if (data.imageUrls !== undefined) updateData.imageUrls = data.imageUrls;
		if (data.liveVideoUrl !== undefined)
			updateData.liveVideoUrl = data.liveVideoUrl;
		if (data.postType !== undefined) updateData.postType = data.postType;

		if (data.privacy !== undefined) updateData.privacy = data.privacy;

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
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
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
			return res
				.status(403)
				.json({ message: "Not authorized to delete this post" });
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



// GET posts from users that current user follows
export const getFollowingFeed = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { uid: string };
    const { limit = "20", cursor } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 100);

    // Get users that current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: authUser.uid },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({ posts: [], nextCursor: null, hasMore: false });
    }

    const where: any = {
      authorId: { in: followingIds },
      privacy: { in: ["public", "followers"] },
    };

    if (cursor) {
      where.id = { lt: cursor as string };
    }

    const posts = await prisma.post.findMany({
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
        comments: {
          take: 3,
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
          orderBy: { createdAt: "desc" },
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
        analytics: true,
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
      orderBy: [
        { analytics: { views: "desc" } },
        { createdAt: "desc" },
      ],
    });

    const hasMore = posts.length > limitNum;
    const postsToReturn = hasMore ? posts.slice(0, limitNum) : posts;
    const nextCursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.id : null;

    const output = postsToReturn.map((p) => ({
      id: p.id,
      content: p.content,
      imageUrls: p.imageUrls,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      stats: {
        comments: p._count.comments,
        likes: p._count.likes,
        views: p.analytics?.views || 0,
        shares: p.analytics?.shares || 0,
      },
      author: {
        ...p.author,
        isFollowedByCurrentUser: true,
      },
      comments: p.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
      })),
      likes: p.likes.map((l) => ({
        user: {
          uid: l.user.uid,
          username: l.user.username,
        },
      })),
      postType: p.postType,
      liveVideoUrl: p.liveVideoUrl,
      privacy: p.privacy,
    }));

    res.json({
      status: "ok",
      posts: output,
      nextCursor,
      hasMore,
      limit: limitNum,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching following feed" });
  }
};

// Track post view for analytics
export const trackPostView = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.postAnalytics.upsert({
      where: { postId: id },
      update: { views: { increment: 1 } },
      create: { postId: id, views: 1 },
    });

    res.json({ message: "View tracked" });
  } catch (error) {
    res.status(500).json({ error: "Error tracking view" });
  }
};
