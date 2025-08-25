import { Request, Response } from "express";
import { parseMentionsToNames } from "../utils/mentions"
import { connect } from "../database/database";

let prisma: any;

(async () => {
	prisma = await connect();
})();

// Get user analytics and statistics
export const getUserAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;
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

		const totalViews = userPosts.reduce((sum: number, post: any) => sum + (post.analytics?.views || 0), 0);
		const totalShares = userPosts.reduce((sum: number, post: any) => sum + (post.analytics?.shares || 0), 0);
		const totalLikes = userPosts.reduce((sum: number, post: any) => sum + post._count.likes, 0);
		const totalComments = userPosts.reduce((sum: number, post: any) => sum + post._count.comments, 0);
		const totalEarnings = userPosts.reduce((sum: number, post: any) => sum + (post.analytics?.earnings || 0), 0);

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

		// Get revenue breakdown
		// Ad revenue from campaigns
		const adRevenue = await prisma.adCampaign.aggregate({
			where: {
				advertiserId: userId,
				createdAt: { gte: startDate },
			},
			_sum: { earnings: true },
		});

		// Subscription revenue
		const subscriptionRevenue = await prisma.userSubscription.aggregate({
			where: {
				creatorId: userId,
				createdAt: { gte: startDate },
				status: "active",
			},
			_sum: { amount: true },
		});

		// Tips and donations
		const tipsReceived = await prisma.tip.aggregate({
			where: {
				receiverId: userId,
				createdAt: { gte: startDate },
			},
			_sum: { amount: true },
		});

		const donationsReceived = await prisma.donation.aggregate({
			where: {
				receiverId: userId,
				createdAt: { gte: startDate },
			},
			_sum: { amount: true },
		});

		// Calculate total revenue including tips in total earnings
		const adRevenueAmount = (adRevenue._sum.earnings || 0) / 100;
		const subscriptionRevenueAmount = (subscriptionRevenue._sum.amount || 0) / 100;
		const tipsAmount = (tipsReceived._sum.amount || 0) / 100;
		const donationsAmount = (donationsReceived._sum.amount || 0) / 100;
		const contentEarningsAmount = totalEarnings / 100;
		
		// Add tip earnings to total earnings for summary
		const totalEarningsWithTips = totalEarnings + (tipsReceived._sum.amount || 0);

		// Check monetization eligibility
		const user = await prisma.user.findUnique({
			where: { uid: userId },
			include: {
				reports: {
					where: {
						status: { in: ["pending", "reviewed"] },
					},
				},
			},
		});

		// Check if user posted within the last 24 hours
		const lastDayPosts = await prisma.post.count({
			where: {
				authorId: userId,
				createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
			},
		});

		const isEligibleForMonetization = 
			currentFollowers >= 500 && 
			lastDayPosts >= 1 && 
			!user?.isBlocked && 
			!user?.isRestricted &&
			(user?.reports?.length || 0) === 0;

		const actualContentEarningsAmount = isEligibleForMonetization ? contentEarningsAmount : 0;
		const actualAdRevenueAmount = isEligibleForMonetization ? adRevenueAmount : 0;
		const actualSubscriptionRevenueAmount = isEligibleForMonetization ? subscriptionRevenueAmount : 0;
		const actualTipsAmount = isEligibleForMonetization ? tipsAmount : 0;
		const actualDonationsAmount = isEligibleForMonetization ? donationsAmount : 0;
		const actualTotalRevenue = actualAdRevenueAmount + actualSubscriptionRevenueAmount + actualTipsAmount + actualDonationsAmount + actualContentEarningsAmount;

		// Top performing posts
		const topPosts = await Promise.all(
			userPosts
				.sort((a: any, b: any) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
				.slice(0, 5)
				.map(async (post: any) => {
					const content = await parseMentionsToNames(post.content || "");
					return {
						id: post.id,
						content: content?.substring(0, 100) + "...",
						views: post.analytics?.views || 0,
						likes: post._count.likes,
						comments: post._count.comments,
						shares: post.analytics?.shares || 0,
						earnings: isEligibleForMonetization ? (post.analytics?.earnings || 0) / 100 : 0,
						createdAt: post.createdAt,
					};
				})
		);

		res.json({
			period: `${periodDays} days`,
			overview: {
				totalPosts: userPosts.length,
				totalViews,
				totalLikes,
				totalComments,
				totalShares,
				totalRevenue: Math.round(actualTotalRevenue * 100) / 100,
				totalEarnings: Math.round((totalEarningsWithTips / 100) * 100) / 100,
				currentFollowers,
				followersGained,
				engagementRate: Math.round(engagementRate * 100) / 100,
			},
			revenue: {
				totalRevenue: actualTotalRevenue,
				totalRevenueFormatted: `$${actualTotalRevenue.toFixed(2)}`,
				breakdown: {
					adRevenue: {
						amount: actualAdRevenueAmount,
						formatted: `$${actualAdRevenueAmount.toFixed(2)}`,
						percentage: actualTotalRevenue > 0 ? Math.round((actualAdRevenueAmount / actualTotalRevenue) * 100) : 0,
					},
					subscriptionRevenue: {
						amount: actualSubscriptionRevenueAmount,
						formatted: `$ ${actualSubscriptionRevenueAmount.toFixed(2)}`,
						percentage: actualTotalRevenue > 0 ? Math.round((actualSubscriptionRevenueAmount / actualTotalRevenue) * 100) : 0,
					},
					tipsEarned: {
						amount: actualTipsAmount,
						formatted: `$${actualTipsAmount.toFixed(2)}`,
						percentage: actualTotalRevenue > 0 ? Math.round((actualTipsAmount / actualTotalRevenue) * 100) : 0,
					},
					donationsEarned: {
						amount: actualDonationsAmount,
						formatted: `$${actualDonationsAmount.toFixed(2)}`,
						percentage: actualTotalRevenue > 0 ? Math.round((actualDonationsAmount / actualTotalRevenue) * 100) : 0,
					},
					contentEarnings: {
						amount: actualContentEarningsAmount,
						formatted: `$${actualContentEarningsAmount.toFixed(2)}`,
						percentage: actualTotalRevenue > 0 ? Math.round((actualContentEarningsAmount / actualTotalRevenue) * 100) : 0,
					},
				},
			},
			monetization: {
				isEligible: isEligibleForMonetization,
				requirements: {
					followers: {
						current: currentFollowers,
						required: 500,
						met: currentFollowers >= 500,
					},
					recentActivity: {
						postsLast24h: lastDayPosts,
						required: 1,
						met: lastDayPosts >= 1,
					},
					accountStatus: {
						blocked: user?.isBlocked || false,
						restricted: user?.isRestricted || false,
						violations: user?.reports?.length || 0,
						goodStanding: !user?.isBlocked && !user?.isRestricted && (user?.reports?.length || 0) === 0,
					},
				},
			},
			topPosts,
		});
	} catch (error) {
		console.error("Error fetching user analytics:", error);
		res.status(500).json({ error: "Error fetching user analytics" });
	}
};

// Get detailed post analytics
export const getPostAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;
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
			hashtags: post.hashtags.map((h: any) => h.tag),
			mentions: post.mentions.map((m: any) => m.username),
		});
	} catch (error) {
		console.error("Error fetching post analytics:", error);
		res.status(500).json({ error: "Error fetching post analytics" });
	}
};

// Get platform-wide statistics (admin only)
export const getPlatformAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;

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
		console.error("Error fetching platform analytics:", error);
		res.status(500).json({ error: "Error fetching platform analytics" });
	}
};