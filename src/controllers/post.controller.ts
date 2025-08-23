/** @format */

import { Request, Response } from "express";
import { connect } from "../database/database";
import { z } from "zod";
import type Comment from "../types/types.comments";
import { deleteImage } from "./image.controller";
import { createPostActivity, deliverActivityToFollowers } from './activitypub.controller';
import { getBaseUrl } from '../config/activitypub';
import type { User } from '../types/types.user';

let prisma: any;

(async () => {
	prisma = await connect();
})();

const CreatePostSchema = z
	.object({
		content: z.string().min(1).max(1000).optional(),
		imageUrls: z.array(z.string().url()).max(10).optional(),
		liveVideoUrl: z
			.string()
			.regex(new RegExp(/^https?:\/\/.*/))
			.optional(),
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
			random = "false",
			quality = "false",
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

		// Determine ordering
		let orderBy: any = { createdAt: "desc" };

		if (quality === "true") {
			// High quality content based on engagement
			orderBy = [
				{ analytics: { views: "desc" } },
				{ analytics: { shares: "desc" } },
				{ _count: { likes: "desc" } },
				{ _count: { comments: "desc" } },
				{ createdAt: "desc" }
			];
		} else if (random === "true") {
			// For random ordering, we'll fetch more posts and shuffle them
			orderBy = { createdAt: "desc" };
		}

		let posts = await prisma.post.findMany({
			where,
			take: random === "true" ? limitNum * 3 : limitNum + 1, // Take more for random selection
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
					where: {
						parentId: null // Only get top-level comments, not replies
					},
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
				analytics: true,
				_count: {
					select: {
						comments: true,
						likes: true,
					},
				},
			},
			orderBy,
		});

		// Shuffle posts if random is requested
		if (random === "true") {
			posts = posts.sort(() => Math.random() - 0.5).slice(0, limitNum + 1);
		}

		const hasMore = posts.length > limitNum;
		const postsToReturn = hasMore ? posts.slice(0, limitNum) : posts;
		const nextCursor =
			hasMore && postsToReturn && postsToReturn.length > 0
				? postsToReturn[postsToReturn.length - 1]?.id
				: null;

		// Get current user's following list for isFollowedByCurrentUser check
		const authUser = (req as any).user as User | undefined;
		let followingIds: string[] = [];
		let blockedByIds: string[] = [];
		let blockingIds: string[] = [];
		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f: any) => f.followingId);

			// Get blocked users
			const blockedBy = await prisma.block.findMany({
				where: { blockedId: authUser.uid },
				select: { blockerId: true },
			});
			blockedByIds = blockedBy.map((b: any) => b.blockerId);

			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockerId);

			// Filter out posts from blocked users
			if (blockedByIds.length > 0 || blockingIds.length > 0) {
				const allBlockedIds = [...new Set([...blockedByIds, ...blockingIds])];
				where.authorId = where.authorId ? 
					{ ...where.authorId, notIn: allBlockedIds } : 
					{ notIn: allBlockedIds };
			}
		}

		// Import mention parsing utility
		const { parseMentionsToNames } = await import('../utils/mentions');

		const output = await Promise.all(postsToReturn.map(async (p: any) => {
			return {
				id: p.id,
				content: p.content ? await parseMentionsToNames(p.content) : p.content,
				imageUrls: p.imageUrls,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				stats: {
					comments: p._count.comments,
					likes: p._count.likes,
					views: p.analytics?.views || 0,
					shares: p.analytics?.shares || 0,
					clicks: p.analytics?.clicks || 0,
				},
				author: {
					...p.author,
					isFollowedByCurrentUser: authUser
						? followingIds.includes(p.author.uid)
						: false,
				},
				comments: await Promise.all(p.comments.map(async (c: Comment) => {
					return {
						id: c.id,
						content: await parseMentionsToNames(c.content),
						createdAt: c.createdAt,
						author: {
							...c.author,
						},
					};
				})),
				likes: p.likes.map((l: any) => {
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
		}));

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
					where: {
						parentId: null // Only get top-level comments, not replies
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
				analytics: true,
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
		const authUser = (req as any).user as User | undefined;
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
				views: post.analytics?.views || 0,
				shares: post.analytics?.shares || 0,
				clicks: post.analytics?.clicks || 0,
			},
			author: {
				...post.author,
				isFollowedByCurrentUser,
			},
			comments: post.comments.map((c: Comment) => {
				return {
					id: c.id,
					content: c.content,
					createdAt: c.createdAt,
					author: {
						...c.author,
					},
				};
			}),
			likes: post.likes.map((l: any) => {
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
		const authUser = (req as any).user as User;
		const { content, imageUrls, liveVideoUrl, postType, privacy } =
			CreatePostSchema.parse(req.body);

		// Import content moderation
		const { moderateContent, moderateImage } = await import('./content.controller');

		// Moderate content
		if (content) {
			const contentModeration = await moderateContent(content);
			if (!contentModeration.isAppropriate) {
				return res.status(400).json({ 
					message: "Content violates community guidelines", 
					reason: contentModeration.reason 
				});
			}
		}

		// Moderate images
		if (imageUrls && imageUrls.length > 0) {
			for (const imageUrl of imageUrls) {
				const imageModeration = await moderateImage(imageUrl);
				if (!imageModeration.isAppropriate) {
					return res.status(400).json({ 
						message: "Image violates community guidelines", 
						reason: imageModeration.reason,
						imageUrl 
					});
				}
			}
		}

		const newPost = await prisma.post.create({
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

		// Return the created post with author information
		const postWithAuthor = await prisma.post.findUnique({
			where: { id: newPost.id },
			include: {
				author: {
					select: {
						uid: true,
						username: true,
						name: true,
						photoURL: true,
						verifiedStatus: true,
					},
				},
				_count: {
					select: {
						likes: true,
						comments: true,
					},
				},
			},
		});

		// Federate public posts to ActivityPub followers
		if (newPost.privacy === 'public') {
			try {
				const baseUrl = getBaseUrl(req);
				const activity = await createPostActivity(newPost, postWithAuthor?.author, baseUrl);
				await deliverActivityToFollowers(activity, postWithAuthor?.author?.username || '');
			} catch (federationError) {
				console.error('Failed to federate post:', federationError);
				// Don't fail the post creation if federation fails
			}
		}

		res.status(201).json({
			success: true,
			message: "Post created successfully",
			data: postWithAuthor,
		});
	} catch (error) {
		console.error("Error creating post:", error);
		res.status(500).json({
			success: false,
			error: "Internal Server Error",
			message: "Failed to create post",
		});
	}
};

// UPDATE post (authenticated only, author only)
export const updatePost = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as User;
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
		const authUser = (req as any).user as User;
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

		// Delete images from Cloudinary before deleting the post
		if (existingPost.imageUrls && existingPost.imageUrls.length > 0) {
			const deletePromises = existingPost.imageUrls.map((imageUrl: string) => 
				deleteImage(imageUrl)
			);
			await Promise.allSettled(deletePromises);
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
		const authUser = (req as any).user as User;
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
					userId: authUser.uid,
					postId: id,
				},
			});
			res.json({ message: "Post liked", liked: true });
		}

		// Recalculate earnings based on new like count
		const postWithCounts = await prisma.post.findUnique({
			where: { id },
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
			const newEarnings = calculatePostEarnings(postWithCounts);
			await prisma.postAnalytics.update({
				where: { id },
				data: { earnings: newEarnings },
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Error toggling like" });
	}
};

// GET posts from users that current user follows
export const getFollowingFeed = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as User;
		const { limit = "20", cursor } = req.query;
		const limitNum = Math.min(parseInt(limit as string), 100);

		// Get users that current user follows
		const following = await prisma.follow.findMany({
			where: { followerId: authUser.uid },
			select: { followingId: true },
		});

		const followingIds = following.map((f: any) => f.followingId);

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
					where: {
						parentId: null // Only get top-level comments, not replies
					},
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
			orderBy: [{ analytics: { views: "desc" } }, { createdAt: "desc" }],
		});

		const hasMore = posts.length > limitNum;
		const postsToReturn = hasMore ? posts.slice(0, limitNum) : posts;
		const nextCursor = hasMore
			? postsToReturn[postsToReturn.length - 1]?.id
			: null;

		const output = postsToReturn.map((p: any) => ({
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
			comments: p.comments.map((c: 
																Comment) => ({
				id: c.id,
				content: c.content,
				createdAt: c.createdAt,
				author: c.author,
			})),
			likes: p.likes.map((l: any) => ({
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

		// Update analytics
		await prisma.postAnalytics.upsert({
			where: { postId: id ?? "" },
			update: { views: { increment: 1 } },
			create: { postId: id ?? "", views: 1 },
		});

		// Recalculate earnings based on new engagement
		const postWithCounts = await prisma.post.findUnique({
			where: { id: id ?? "" },
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
			const newEarnings = calculatePostEarnings(postWithCounts);
			await prisma.postAnalytics.update({
				where: { postId: id ?? "" },
				data: { earnings: newEarnings },
			});
		}

		res.json({ message: "View tracked and earnings updated" });
	} catch (error: any) {
		res.status(500).json({ error: "Error tracking view: " + error?.message });
	}
};

// Calculate earnings based on engagement metrics
export const calculatePostEarnings = (post: any) => {
	try {
		const views = post.analytics?.views || 0;
		const shares = post.analytics?.shares || 0;
		const likes = post._count.likes || 0;
		const comments = post._count.comments || 0;

		// Calculate total engagement score
		// Weighted formula: views * 1 + likes * 5 + comments * 10 + shares * 15
		const engagementScore = views * 1 + likes * 5 + comments * 10 + shares * 15;

		// Earnings calculation: $0.01 per post if engagement >= 1,000,000
		let earnings = 0;
		if (engagementScore >= 1000) {
			earnings = 0.001; // $0.001 in dollars (you can store as cents: 0.01)
		}

		return Math.round(earnings * 100); // Store as cents
	} catch (error) {
		console.error("Error calculating earnings:", error);
		return 0;
	}
};

export const trackEarnings = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Calculate earnings based on current engagement
		const post = await prisma.post.findUnique({
			where: { id: id ?? "" },
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

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const earnings = calculatePostEarnings(post);
		await prisma.postAnalytics.update({
			where: { postId: id ?? "" },
			data: { earnings: earnings },
		});

		res.json({
			message: "Earnings calculated and tracked",
			earnings: earnings / 100, // Return in dollars
			earningsInCents: earnings,
		});
	} catch (error) {
		res.status(500).json({ error: "Error tracking earnings" });
	}
};

// Auto-calculate earnings when engagement metrics are updated
export const updatePostEngagement = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { action } = req.body; // 'like', 'comment', 'share', 'view'

		// Update the specific metric based on action
		switch (action) {
			case "view":
				await prisma.postAnalytics.upsert({
					where: { postId: id ?? "" },
					update: { views: { increment: 1 } },
					create: { postId: id ?? "", views: 1 },
				});
				break;
			case "share":
				await prisma.postAnalytics.upsert({
					where: { postId: id ?? "" },
					update: { shares: { increment: 1 } },
					create: { postId: id ?? "", shares: 1 },
				});
				break;
		}

		// Recalculate earnings after any engagement update
		const postWithCounts = await prisma.post.findUnique({
			where: { id: id ?? "" },
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
			const earnings = calculatePostEarnings(postWithCounts);
			await prisma.postAnalytics.update({
				where: { postId: id ?? "" },
				data: { earnings: earnings },
			});
			res.json({
				message: `${action} tracked and earnings updated`,
				earnings: earnings / 100, // Return in dollars
			});
		} else {
			res.status(404).json({ message: "Post not found" });
		}
	} catch (error) {
		res.status(500).json({ error: "Error updating engagement" });
	}
};

// SHARE post (authenticated only)
export const sharePost = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		if (!id) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		// Increment the shares count in post analytics
		await prisma.postAnalytics.update({
			where: { postId: id },
			data: { shares: { increment: 1 } },
		});

		res.json({ message: "Post shared successfully" });
	} catch (error) {
		res.status(500).json({ error: "Error sharing post" });
	}
};

// Get current user's posts
export const getCurrentUserPosts = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as User;

		// Fetch posts authored by the current user
		const posts = await prisma.post.findMany({
			where: { authorId: authUser.uid },
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
				comments: {
					where: {
						parentId: null // Only get top-level comments, not replies
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
					orderBy: {
						createdAt: "desc",
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
			orderBy: {
				createdAt: "desc",
			},
		});

		const { parseMentionsToNames } = await import('../utils/mentions');

		const output = posts.map((p: any) => {
			return {
				id: p.id,
				content: parseMentionsToNames(p.content),
				imageUrls: p.imageUrls,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				stats: {
					comments: p._count.comments,
					likes: p._count.likes,
					earnings: p.analytics?.earnings || 0,
					views: p.analytics?.views || 0,
					shares: p.analytics?.shares || 0,
					clicks: p.analytics?.clicks || 0,
				},
				author: {
					...p.author,
					isFollowedByCurrentUser: false,
				},
				likes: p.likes.map((l: any) => {
					return {
						user: {
							uid: l.user.uid,
							username: l.user.username,
						},
					};
				}),
				comments: p.comments.map((c: Comment) => {
					return {
						id: c.id,
						content: c.content,
						createdAt: c.createdAt,
						author: {
							...c.author,
						},
					};
				}),
				postType: p.postType,
				liveVideoUrl: p.liveVideoUrl,
				privacy: p.privacy,
			};
		});

		res.json({ status: "ok", posts: output });
	} catch (error) {
		res.status(500).json({ error: "Error fetching user posts" });
	}
};