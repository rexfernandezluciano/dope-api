
import { Request, Response } from "express";
import { prisma } from "../database/database";

// Get user recommendations based on activities
export const getUserRecommendations = async (req: Request, res: Response) => {
	try {
		const userId = req.user?.uid;
		const { limit = 10, type = "users" } = req.query;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		if (type === "users") {
			// Get users the current user follows
			const userFollowing = await prisma.follow.findMany({
				where: { followerId: userId },
				select: { followingId: true },
			});

			const followingIds = userFollowing.map((f) => f.followingId);

			// Find users that followed users also follow (collaborative filtering)
			const recommendations = await prisma.user.findMany({
				where: {
					uid: {
						notIn: [...followingIds, userId],
					},
					isBlocked: false,
					isRestricted: false,
					followers: {
						some: {
							followerId: {
								in: followingIds,
							},
						},
					},
				},
				select: {
					uid: true,
					username: true,
					name: true,
					photoURL: true,
					hasBlueCheck: true,
					bio: true,
					_count: {
						select: {
							followers: true,
							posts: true,
						},
					},
				},
				take: Number(limit),
				orderBy: [
					{ hasBlueCheck: "desc" },
					{ followers: { _count: "desc" } },
				],
			});

			res.json({
				recommendations: recommendations.map((user) => ({
					...user,
					followersCount: user._count.followers,
					postsCount: user._count.posts,
				})),
				type: "users",
			});
		} else if (type === "posts") {
			// Get posts from users the current user follows
			const userInterests = await prisma.like.findMany({
				where: { userId },
				include: {
					post: {
						include: {
							hashtags: true,
							author: true,
						},
					},
				},
				take: 50,
				orderBy: { createdAt: "desc" },
			});

			// Extract hashtags from liked posts
			const hashtagsFromLikes = userInterests.flatMap((like) =>
				like.post.hashtags.map((h) => h.tag)
			);

			// Find posts with similar hashtags
			const recommendedPosts = await prisma.post.findMany({
				where: {
					authorId: { not: userId },
					hashtags: {
						some: {
							tag: { in: hashtagsFromLikes },
						},
					},
					privacy: "public",
				},
				include: {
					author: {
						select: {
							uid: true,
							username: true,
							name: true,
							photoURL: true,
							hasBlueCheck: true,
						},
					},
					_count: {
						select: {
							likes: true,
							comments: true,
						},
					},
					analytics: true,
				},
				take: Number(limit),
				orderBy: [
					{ analytics: { views: "desc" } },
					{ createdAt: "desc" },
				],
			});

			res.json({
				recommendations: recommendedPosts.map((post) => ({
					...post,
					likesCount: post._count.likes,
					commentsCount: post._count.comments,
				})),
				type: "posts",
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Error fetching recommendations" });
	}
};

// Get trending hashtags
export const getTrendingHashtags = async (req: Request, res: Response) => {
	try {
		const { limit = 10 } = req.query;

		const trendingHashtags = await prisma.hashtag.groupBy({
			by: ["tag"],
			_count: {
				tag: true,
			},
			where: {
				createdAt: {
					gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
				},
			},
			orderBy: {
				_count: {
					tag: "desc",
				},
			},
			take: Number(limit),
		});

		res.json({
			trending: trendingHashtags.map((hashtag) => ({
				tag: hashtag.tag,
				count: hashtag._count.tag,
			})),
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching trending hashtags" });
	}
};
