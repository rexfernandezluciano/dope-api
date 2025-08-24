/** @format */

import { Request, Response } from "express";
import { connect } from "../database/database";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

let prisma: any;

(async () => {
	prisma = await connect();
})();

const CreateCommentSchema = z.object({
	content: z.string().min(1).max(500),
});

const UpdateCommentSchema = z.object({
	content: z.string().min(1).max(500),
});

const CreateCommentWithTipSchema = z.object({
	content: z.string().min(1).max(500),
	tipAmount: z.number().min(100).max(500000).optional(), // Min ₱1, Max ₱5000
	stickerId: z.string().optional(),
});

const CreateCommentWithDonationSchema = z.object({
	content: z.string().min(1).max(500),
	donationAmount: z.number().min(500).max(1000000).optional(), // Min ₱5, Max ₱10000
	isAnonymous: z.boolean().default(false),
});

const SearchCommentsSchema = z.object({
	query: z.string().min(1).max(100),
	limit: z.string().optional(),
	cursor: z.string().optional(),
	author: z.string().optional(),
	postId: z.string().optional(),
	sortBy: z.enum(["desc", "asc"]).optional(),
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
		const where: any = { 
			postId,
			parentId: null // Only get top-level comments, not replies
		};

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
		const { content, tipAmount, donationAmount, stickerId, isAnonymous } = req.body;

		// Validate input based on whether it's a tip or donation
		let validatedData;
		if (tipAmount) {
			validatedData = CreateCommentWithTipSchema.parse(req.body);
		} else if (donationAmount) {
			validatedData = CreateCommentWithDonationSchema.parse(req.body);
		} else {
			validatedData = CreateCommentSchema.parse(req.body);
		}

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				author: {
					select: {
						uid: true,
						username: true,
						name: true,
					},
				},
			},
		});

		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		// Check if user is trying to tip/donate to themselves
		if ((tipAmount || donationAmount) && authUser.uid === post.authorId) {
			return res.status(400).json({ message: "You cannot send tips or donations to yourself" });
		}

		// Check user's credits if tip/donation is included
		let senderCredits = 0;
		if (tipAmount || donationAmount) {
			const sender = await prisma.user.findUnique({
				where: { uid: authUser.uid },
				select: { credits: true },
			});

			if (!sender) {
				return res.status(404).json({ message: "User not found" });
			}

			senderCredits = sender.credits;
			const requiredAmount = tipAmount || donationAmount;

			if (senderCredits < requiredAmount) {
				return res.status(400).json({
					message: "Insufficient credits",
					availableCredits: senderCredits,
					requiredCredits: requiredAmount,
				});
			}
		}

		// Create comment and handle credit transfers in a transaction
		const transactionResults = await prisma.$transaction(async (tx: PrismaClient) => {
			// Create the comment
			const comment = await tx.comment.create({
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
					_count: {
						select: {
							likes: true,
							replies: true,
						},
					},
				},
			});

			let paymentResult = null;

			// Handle tip with credit transfer
			if (tipAmount) {
				try {
					// Create tip record
					const tip = await tx.tip.create({
						data: {
							senderId: authUser.uid,
							receiverId: post.authorId,
							amount: tipAmount,
							message: `Tip with comment: ${content}`,
							postId: postId,
							stickerId: stickerId,
						},
					});

					// Transfer credits
					await tx.user.update({
						where: { uid: authUser.uid },
						data: { credits: { decrement: tipAmount } },
					});

					await tx.user.update({
						where: { uid: post.authorId },
						data: { credits: { increment: tipAmount } },
					});

					paymentResult = { 
						type: 'tip', 
						status: 'completed',
						amount: tipAmount,
						tipId: tip.id,
						remainingCredits: senderCredits - tipAmount
					};
				} catch (tipError: any) {
					console.error("Tip credit transfer failed:", tipError);
					throw new Error("Failed to process tip: " + tipError.message);
				}
			}

			// Handle donation with credit transfer
			if (donationAmount) {
				try {
					// Create donation record
					const donation = await tx.donation.create({
						data: {
							senderId: authUser.uid,
							receiverId: post.authorId,
							amount: donationAmount,
							message: `Donation with comment: ${content}`,
							isAnonymous: isAnonymous || false,
						},
					});

					// Transfer credits
					await tx.user.update({
						where: { uid: authUser.uid },
						data: { credits: { decrement: donationAmount } },
					});

					await tx.user.update({
						where: { uid: post.authorId },
						data: { credits: { increment: donationAmount } },
					});

					paymentResult = { 
						type: 'donation', 
						status: 'completed',
						amount: donationAmount,
						donationId: donation.id,
						isAnonymous: isAnonymous,
						remainingCredits: senderCredits - donationAmount
					};
				} catch (donationError: any) {
					console.error("Donation credit transfer failed:", donationError);
					throw new Error("Failed to process donation: " + donationError.message);
				}
			}

			return { comment, paymentResult };
		});

		const { comment, paymentResult } = transactionResults;

		const response: any = {
			...comment,
			tipAmount: tipAmount || null,
			donationAmount: donationAmount || null,
		};

		if (paymentResult) {
			response.payment = paymentResult;
		}

		res.status(201).json(response);

		// Update post earnings based on new comment
		const postWithCounts = await prisma.post.findUnique({
			where: { id: postId },
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
			// Calculate earnings based on engagement metrics
			const views = postWithCounts.analytics?.views || 0;
			const shares = postWithCounts.analytics?.shares || 0;
			const likes = postWithCounts._count?.likes || 0;
			const comments = postWithCounts._count?.comments || 0;

			const totalEngagement = views + (shares * 2) + (likes * 1.5) + (comments * 3);
			const newEarnings = totalEngagement >= 1000000 ? 0.01 : 0;

			await prisma.postAnalytics.update({
				where: { id: postId },
				data: { earnings: newEarnings },
			});
		}
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

// SEARCH comments globally
export const searchComments = async (req: Request, res: Response) => {
	try {
		const {
			query,
			limit = "20",
			cursor,
			author,
			postId,
			sortBy = "desc"
		} = SearchCommentsSchema.parse(req.query);

		const limitNum = Math.min(parseInt(limit), 100); // Max 100 comments per request

		// Build where clause for filtering
		const where: any = {
			content: {
				contains: query,
				mode: "insensitive"
			}
		};

		// Filter by author if specified
		if (author) {
			const authorUser = await prisma.user.findUnique({
				where: { username: author },
				select: { uid: true }
			});

			if (authorUser) {
				where.authorId = authorUser.uid;
			} else {
				return res.json({ comments: [], nextCursor: null, hasMore: false });
			}
		}

		// Filter by post if specified
		if (postId) {
			where.postId = postId;
		}

		// Add cursor pagination
		if (cursor) {
			if (sortBy === "asc") {
				where.id = { gt: cursor };
			} else {
				where.id = { lt: cursor };
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
				post: {
					select: {
						id: true,
						content: true,
						postType: true,
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
			query,
		});
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res.status(400).json({ message: "Invalid query parameters", errors: err.errors });
		}
		res.status(500).json({ error: "Error searching comments" });
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

// Helper function to process tip payments
const processTipPayment = async (tipData: {
	senderId: string;
	receiverId: string;
	amount: number;
	message: string;
	postId: string;
	stickerId?: string;
	paymentMethodId: string;
}) => {
	const paypalAPI = require('axios').create({
		baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			"Accept-Language": "en_US",
		},
	});

	// Get PayPal access token (simplified - in production you'd want to use the same token caching logic)
	const tokenResponse = await paypalAPI.post(
		"/v1/oauth2/token",
		"grant_type=client_credentials",
		{
			headers: {
				Authorization: `Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		},
	);

	const accessToken = tokenResponse.data.access_token;

	const paymentMethod = await prisma.paymentMethod.findFirst({
		where: { id: tipData.paymentMethodId, userId: tipData.senderId },
	});

	if (!paymentMethod) {
		throw new Error("Payment method not found");
	}

	const receiver = await prisma.user.findUnique({
		where: { uid: tipData.receiverId },
		select: { username: true, name: true },
	});

	const paypalOrder = await paypalAPI.post(
		"/v2/checkout/orders",
		{
			intent: "CAPTURE",
			purchase_units: [
				{
					amount: {
						currency_code: "PHP",
						value: (tipData.amount / 100).toFixed(2),
					},
					description: `Tip to @${receiver?.username} via comment`,
					custom_id: `tip_comment_${tipData.senderId}_${tipData.receiverId}_${tipData.amount}_${tipData.paymentMethodId}`,
				},
			],
			payment_source:
				paymentMethod.type === "paypal_wallet"
					? {
							paypal: {
								email_address: paymentMethod.paypalEmail,
								experience_context: {
									return_url: `${process.env.FRONTEND_URL}/tip/success`,
									cancel_url: `${process.env.FRONTEND_URL}/tip/cancel`,
								},
							},
						}
					: {
							card: {
								vault_id: paymentMethod.paypalPaymentMethodId,
							},
						},
		},
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);

	const approveUrl = paypalOrder.data.links?.find(
		(link: any) => link.rel === "approve" || link.rel === "payer-action"
	)?.href || null;

	return {
		paymentIntentId: paypalOrder.data.id,
		approveUrl: approveUrl,
		amount: tipData.amount,
		currency: "PHP",
		status: paypalOrder.data.status,
	};
};

// Helper function to process donation payments
const processDonationPayment = async (donationData: {
	senderId: string;
	receiverId: string;
	amount: number;
	message: string;
	isAnonymous: boolean;
	paymentMethodId: string;
}) => {
	const paypalAPI = require('axios').create({
		baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			"Accept-Language": "en_US",
		},
	});

	// Get PayPal access token
	const tokenResponse = await paypalAPI.post(
		"/v1/oauth2/token",
		"grant_type=client_credentials",
		{
			headers: {
				Authorization: `Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		},
	);

	const accessToken = tokenResponse.data.access_token;

	const paymentMethod = await prisma.paymentMethod.findFirst({
		where: { id: donationData.paymentMethodId, userId: donationData.senderId },
	});

	if (!paymentMethod) {
		throw new Error("Payment method not found");
	}

	const receiver = await prisma.user.findUnique({
		where: { uid: donationData.receiverId },
		select: { username: true, name: true },
	});

	const paypalOrder = await paypalAPI.post(
		"/v2/checkout/orders",
		{
			intent: "CAPTURE",
			purchase_units: [
				{
					amount: {
						currency_code: "PHP",
						value: (donationData.amount / 100).toFixed(2),
					},
					description: `Donation to @${receiver?.username} via comment`,
					custom_id: `donation_comment_${donationData.senderId}_${donationData.receiverId}_${donationData.amount}_${donationData.paymentMethodId}`,
				},
			],
			payment_source:
				paymentMethod.type === "paypal_wallet"
					? {
							paypal: {
								email_address: paymentMethod.paypalEmail,
								experience_context: {
									return_url: `${process.env.FRONTEND_URL}/donation/success`,
									cancel_url: `${process.env.FRONTEND_URL}/donation/cancel`,
								},
							},
						}
					: {
							card: {
								vault_id: paymentMethod.paypalPaymentMethodId,
							},
						},
		},
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);

	const approveUrl = paypalOrder.data.links?.find(
		(link: any) => link.rel === "approve" || link.rel === "payer-action"
	)?.href || null;

	return {
		paymentIntentId: paypalOrder.data.id,
		approveUrl: approveUrl,
		amount: donationData.amount,
		currency: "PHP",
		status: paypalOrder.data.status,
	};
};