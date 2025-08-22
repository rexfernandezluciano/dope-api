
import { Request, Response } from "express";
import { prisma } from "../database/database";

// Get user analytics and statistics
export const getUserAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = req.user?.uid;
		const { period = "30d" } = req.query;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
		const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

		// Get user's posts analytics
		const userPosts = await prisma.post.findMany({
			where: {
				authorId: userId,
				createdAt: { gte: startDate },
			},
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

		const totalViews = userPosts.reduce((sum, post) => sum + (post.analytics?.views || 0), 0);
		const totalShares = userPosts.reduce((sum, post) => sum + (post.analytics?.shares || 0), 0);
		const totalLikes = userPosts.reduce((sum, post) => sum + post._count.likes, 0);
		const totalComments = userPosts.reduce((sum, post) => sum + post._count.comments, 0);
		const totalEarnings = userPosts.reduce((sum, post) => sum + (post.analytics?.earnings || 0), 0);

		// Get follower growth
		const followers = await prisma.follow.findMany({
			where: {
				followingId: userId,
				createdAt: { gte: startDate },
			},
		});

		const currentFollowers = await prisma.follow.count({
			where: { followingId: userId },
		});

		const followersGained = followers.length;

		// Get engagement rate
		const totalEngagement = totalLikes + totalComments + totalShares;
		const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

		// Top performing posts
		const topPosts = userPosts
			.sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
			.slice(0, 5)
			.map(post => ({
				id: post.id,
				content: post.content?.substring(0, 100) + "...",
				views: post.analytics?.views || 0,
				likes: post._count.likes,
				comments: post._count.comments,
				shares: post.analytics?.shares || 0,
				earnings: (post.analytics?.earnings || 0) / 100,
				createdAt: post.createdAt,
			}));

		res.json({
			period: `${periodDays} days`,
			overview: {
				totalPosts: userPosts.length,
				totalViews,
				totalLikes,
				totalComments,
				totalShares,
				totalEarnings: totalEarnings / 100,
				currentFollowers,
				followersGained,
				engagementRate: Math.round(engagementRate * 100) / 100,
			},
			topPosts,
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching user analytics" });
	}
};

// Get detailed post analytics
export const getPostAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = req.user?.uid;
		const { postId } = req.params;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const post = await prisma.post.findFirst({
			where: { id: postId, authorId: userId },
			include: {
				analytics: true,
				_count: {
					select: {
						likes: true,
						comments: true,
					},
				},
				hashtags: true,
				mentions: true,
			},
		});

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const analytics = post.analytics || {
			views: 0,
			shares: 0,
			clicks: 0,
			earnings: 0,
		};

		const totalEngagement = analytics.views + post._count.likes + post._count.comments + analytics.shares;
		const engagementRate = analytics.views > 0 ? ((post._count.likes + post._count.comments + analytics.shares) / analytics.views) * 100 : 0;

		res.json({
			post: {
				id: post.id,
				content: post.content,
				createdAt: post.createdAt,
				postType: post.postType,
			},
			analytics: {
				views: analytics.views,
				likes: post._count.likes,
				comments: post._count.comments,
				shares: analytics.shares,
				clicks: analytics.clicks,
				earnings: analytics.earnings / 100,
				engagementRate: Math.round(engagementRate * 100) / 100,
				totalEngagement,
			},
			hashtags: post.hashtags.map(h => h.tag),
			mentions: post.mentions.map(m => m.username),
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching post analytics" });
	}
};

// Get platform-wide statistics (admin only)
export const getPlatformAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = req.user?.uid;

		// Check if user is admin (you might want to add an admin role check)
		const user = await prisma.user.findUnique({
			where: { uid: userId },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// For now, assuming premium users can see platform stats
		if (user.subscription === "free") {
			return res.status(403).json({ error: "Premium subscription required" });
		}

		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

		const totalUsers = await prisma.user.count();
		const activeUsers = await prisma.user.count({
			where: {
				updatedAt: { gte: thirtyDaysAgo },
			},
		});

		const totalPosts = await prisma.post.count();
		const recentPosts = await prisma.post.count({
			where: {
				createdAt: { gte: thirtyDaysAgo },
			},
		});

		const totalComments = await prisma.comment.count();
		const totalLikes = await prisma.like.count();

		const totalViews = await prisma.postAnalytics.aggregate({
			_sum: { views: true },
		});

		const totalEarnings = await prisma.postAnalytics.aggregate({
			_sum: { earnings: true },
		});

		const totalAdSpend = await prisma.adCampaign.aggregate({
			_sum: { spent: true },
		});

		res.json({
			platform: {
				totalUsers,
				activeUsers,
				totalPosts,
				recentPosts,
				totalComments,
				totalLikes,
				totalViews: totalViews._sum.views || 0,
				totalEarnings: (totalEarnings._sum.earnings || 0) / 100,
				totalAdSpend: (totalAdSpend._sum.spent || 0) / 100,
			},
			growth: {
				userGrowthRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
				contentGrowthRate: totalPosts > 0 ? (recentPosts / totalPosts) * 100 : 0,
			},
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching platform analytics" });
	}
};
