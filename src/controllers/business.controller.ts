import { Request, Response } from "express";
import { connect } from "../database/database";

let prisma: any;

(async () => {
	prisma = await connect();
})();

// Create advertisement campaign
export const createAdCampaign = async (req: Request, res: Response) => {
	try {
		const userId: string = (req.user as any).uid;
		const {
			title,
			description,
			targetType,
			targetId,
			budget,
			duration,
			targetAudience,
			adType,
		} = req.body;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		// Check user's current credits
		const user = await prisma.user.findUnique({
			where: { uid: userId },
			select: { credits: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const budgetInCentavos = Math.round(budget * 100);
		
		// Check if user has sufficient credits
		if (user.credits < budgetInCentavos) {
			return res.status(400).json({
				error: "Insufficient credits",
				message: `You need ₱${(budgetInCentavos / 100).toFixed(2)} but only have ₱${(user.credits / 100).toFixed(2)} in credits.`,
				required: budgetInCentavos / 100,
				available: user.credits / 100,
				shortfall: (budgetInCentavos - user.credits) / 100,
			});
		}

		const campaign = await prisma.adCampaign.create({
			data: {
				title,
				description,
				targetType,
				targetId,
				budget: budgetInCentavos, // Store as centavos
				duration,
				targetAudience: targetAudience || {},
				adType,
				advertiserId: userId,
				status: "pending",
			},
		});

		res.status(201).json({
			message: "Ad campaign created successfully",
			campaign: {
				...campaign,
				budget: campaign.budget / 100, // Return as pesos
			},
			creditsRemaining: user.credits / 100,
		});
	} catch (error) {
		res.status(500).json({ error: "Error creating ad campaign" });
	}
};

// Get user's ad campaigns
export const getAdCampaigns = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;
		const { page = 1, limit = 10, status } = req.query;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const skip = (Number(page) - 1) * Number(limit);
		const where: any = { advertiserId: userId };

		if (status) {
			where.status = status;
		}

		const campaigns = await prisma.adCampaign.findMany({
			where,
			include: {
				analytics: true,
			},
			skip,
			take: Number(limit),
			orderBy: { createdAt: "desc" },
		});

		const total = await prisma.adCampaign.count({ where });

		res.json({
			campaigns: campaigns.map((campaign: any) => ({
				...campaign,
				budget: campaign.budget / 100,
				spent: campaign.spent / 100,
				earnings: campaign.earnings / 100,
			})),
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching ad campaigns" });
	}
};

// Update ad campaign
export const updateAdCampaign = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;
		const { id } = req.params;
		const { title, description, budget, status, targetAudience } = req.body;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const campaign = await prisma.adCampaign.findFirst({
			where: { id, advertiserId: userId },
		});

		if (!campaign) {
			return res.status(404).json({ error: "Campaign not found" });
		}

		const updateData: any = {};
		if (title) updateData.title = title;
		if (description) updateData.description = description;
		if (budget) updateData.budget = Math.round(budget * 100);
		if (status) updateData.status = status;
		if (targetAudience) updateData.targetAudience = targetAudience;

		const updatedCampaign = await prisma.adCampaign.update({
			where: { id },
			data: updateData,
		});

		res.json({
			message: "Campaign updated successfully",
			campaign: {
				...updatedCampaign,
				budget: updatedCampaign.budget / 100,
				spent: updatedCampaign.spent / 100,
				earnings: updatedCampaign.earnings / 100,
			},
		});
	} catch (error) {
		res.status(500).json({ error: "Error updating campaign" });
	}
};

// Track ad interaction (impression, click, conversion)
export const trackAdInteraction = async (req: Request, res: Response) => {
	try {
		const { campaignId, action, userId: viewerId } = req.body;

		if (!campaignId || !action) {
			return res.status(400).json({ error: "Campaign ID and action required" });
		}

		const campaign = await prisma.adCampaign.findUnique({
			where: { id: campaignId },
		});

		if (!campaign || campaign.status !== "active") {
			return res.status(404).json({ error: "Active campaign not found" });
		}

		// Update analytics based on action
		let earnings = 0;
		let cost = 0;

		switch (action) {
			case "impression":
				await prisma.adAnalytics.upsert({
					where: { campaignId },
					update: { impressions: { increment: 1 } },
					create: { campaignId, impressions: 1 },
				});
				cost = 0.001; // $0.001 per impression
				break;
			case "click":
				await prisma.adAnalytics.upsert({
					where: { campaignId },
					update: { clicks: { increment: 1 } },
					create: { campaignId, clicks: 1 },
				});
				cost = 0.1; // $0.10 per click
				earnings = 0.05; // $0.05 earnings for advertiser
				break;
			case "conversion":
				await prisma.adAnalytics.upsert({
					where: { campaignId },
					update: { conversions: { increment: 1 } },
					create: { campaignId, conversions: 1 },
				});
				cost = 2.0; // $2.00 per conversion
				earnings = 1.0; // $1.00 earnings for advertiser
				break;
		}

		// Update campaign spending and earnings
		const updatedCampaign = await prisma.adCampaign.update({
			where: { id: campaignId },
			data: {
				spent: { increment: Math.round(cost * 100) },
				earnings: { increment: Math.round(earnings * 100) },
			},
		});

		// Deduct credits from advertiser's account
		await prisma.user.update({
			where: { uid: updatedCampaign.advertiserId },
			data: {
				credits: { decrement: Math.round(cost * 100) },
			},
		});

		res.json({
			message: `${action} tracked successfully`,
			cost: cost,
			earnings: earnings,
		});
	} catch (error) {
		res.status(500).json({ error: "Error tracking ad interaction" });
	}
};

// Get ad analytics
export const getAdAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;
		const { campaignId } = req.params;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const campaign = await prisma.adCampaign.findFirst({
			where: { id: campaignId, advertiserId: userId },
			include: {
				analytics: true,
			},
		});

		if (!campaign) {
			return res.status(404).json({ error: "Campaign not found" });
		}

		const analytics = campaign.analytics || {
			impressions: 0,
			clicks: 0,
			conversions: 0,
		};

		const ctr =
			analytics.impressions > 0
				? (analytics.clicks / analytics.impressions) * 100
				: 0;
		const conversionRate =
			analytics.clicks > 0
				? (analytics.conversions / analytics.clicks) * 100
				: 0;
		const costPerClick =
			analytics.clicks > 0 ? campaign.spent / 100 / analytics.clicks : 0;

		res.json({
			campaign: {
				id: campaign.id,
				title: campaign.title,
				status: campaign.status,
				budget: campaign.budget / 100,
				spent: campaign.spent / 100,
				earnings: campaign.earnings / 100,
			},
			analytics: {
				...analytics,
				ctr: Math.round(ctr * 100) / 100,
				conversionRate: Math.round(conversionRate * 100) / 100,
				costPerClick: Math.round(costPerClick * 100) / 100,
			},
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching ad analytics" });
	}
};

// Get business dashboard overview
export const getBusinessDashboard = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any).uid;

		if (!userId) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const campaigns = await prisma.adCampaign.findMany({
			where: { advertiserId: userId },
			include: {
				analytics: true,
			},
		});

		const totalSpent =
			campaigns.reduce((sum: number, c: any) => sum + c.spent, 0) / 100;
		const totalEarnings =
			campaigns.reduce((sum: number, c: any) => sum + c.earnings, 0) / 100;
		const totalImpressions = campaigns.reduce(
			(sum: number, c: any) => sum + (c.analytics?.impressions || 0),
			0,
		);
		const totalClicks = campaigns.reduce(
			(sum: number, c: any) => sum + (c.analytics?.clicks || 0),
			0,
		);
		const totalConversions = campaigns.reduce(
			(sum: number, c: any) => sum + (c.analytics?.conversions || 0),
			0,
		);

		const activeCampaigns = campaigns.filter(
			(c: any) => c.status === "active",
		).length;
		const avgCTR =
			totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

		// Get user's current credits
		const user = await prisma.user.findUnique({
			where: { uid: userId },
			select: { credits: true },
		});

		res.json({
			overview: {
				totalCampaigns: campaigns.length,
				activeCampaigns,
				totalSpent,
				totalEarnings,
				netProfit: totalEarnings - totalSpent,
				currentCredits: user?.credits ? user.credits / 100 : 0,
			},
			analytics: {
				totalImpressions,
				totalClicks,
				totalConversions,
				averageCTR: Math.round(avgCTR * 100) / 100,
			},
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching business dashboard" });
	}
};
