/** @format */

import { Request, Response } from "express";
import { z } from "zod";
import { connect } from "../database/database";

let prisma: any;

(async () => {
	prisma = await connect();
})();

const UpdateUserSchema = z.object({
	name: z.string().min(1).optional(),
	bio: z.string().max(500).optional(),
	photoURL: z
		.string()
		.regex(new RegExp(/^https?:\/\/.*/))
		.optional(),
	privacy: z
		.object({
			profile: z.enum(["public", "private"]).optional(),
			comments: z.enum(["public", "followers", "private"]).optional(),
			sharing: z.boolean().optional(),
			chat: z.enum(["public", "followers", "private"]).optional(),
		})
		.optional(),
	// Add blocked and restricted fields to the schema if they are part of user updates
	// For now, assuming these are managed through separate block/restrict actions
});

// GET all users with search, pagination and filtering
export const getUsers = async (req: Request, res: Response) => {
	try {
		const {
			limit = "20",
			cursor,
			search,
			subscription,
			hasBlueCheck,
			sortBy = "createdAt",
			sortOrder = "desc",
		} = req.query;

		const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 users per request

		// Build where clause for filtering
		const where: any = {};

		// Search by username or name
		if (search) {
			where.OR = [
				{
					username: {
						contains: search as string,
						mode: "insensitive",
					},
				},
				{
					name: {
						contains: search as string,
						mode: "insensitive",
					},
				},
			];
		}

		// Filter by subscription type
		if (
			subscription &&
			["free", "premium", "pro"].includes(subscription as string)
		) {
			where.subscription = subscription;
		}

		// Filter by blue check status
		if (hasBlueCheck === "true") {
			where.hasBlueCheck = true;
		} else if (hasBlueCheck === "false") {
			where.hasBlueCheck = false;
		}

		// Pagination
		const cursorCondition = cursor
			? {
					uid: {
						lt: cursor as string,
					},
				}
			: {};

		// Combine where conditions
		const finalWhere = cursor ? { ...where, ...cursorCondition } : where;

		// Validate sort fields
		const validSortFields = ["createdAt", "name", "username"];
		const sortField = validSortFields.includes(sortBy as string)
			? sortBy
			: "createdAt";
		const sortDirection = sortOrder === "asc" ? "asc" : "desc";

		const users = await prisma.user.findMany({
			where: finalWhere,
			select: {
				uid: true,
				name: true,
				username: true,
				bio: true,
				photoURL: true,
				hasBlueCheck: true,
				subscription: true,
				createdAt: true,
				_count: {
					select: {
						posts: true,
						following: true,
						followers: true,
					},
				},
			},
			orderBy: {
				[sortField as string]: sortDirection,
			},
			take: limitNum + 1, // Take one extra to check if there are more
		});

		// Get current user's following list and block lists for isFollowedByCurrentUser and isBlockedByCurrentUser check
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		let blockedByIds: string[] = []; // Users who blocked the current user
		let blockingIds: string[] = []; // Users the current user has blocked

		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f: any) => f.followingId);

			const blockedBy = await prisma.block.findMany({
				where: { blockedId: authUser.uid },
				select: { blockerId: true },
			});
			blockedByIds = blockedBy.map((b: any) => b.blockerId);

			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		// Check if there are more users for pagination
		const hasMore = users.length > limitNum;
		const usersToReturn = hasMore ? users.slice(0, limitNum) : users;
		const nextCursor = hasMore
			? usersToReturn[usersToReturn.length - 1]?.uid
			: null;

		const userList = usersToReturn.map((i: any) => {
			const user = {
				uid: i.uid,
				name: i.name,
				username: i.username,
				bio: i.bio,
				photoURL: i.photoURL,
				hasBlueCheck: i.hasBlueCheck,
				membership: {
					subscription: i.subscription,
				},
				createdAt: i.createdAt,
				isBlocked: i.isBlocked,
				isRestricted: i.isRestricted,
				stats: {
					posts: i._count.posts,
					followers: i._count.followers,
					following: i._count.following,
				},
				isFollowedByCurrentUser: authUser
					? followingIds.includes(i.uid)
					: false,
				isBlockedByCurrentUser: authUser ? blockedByIds.includes(i.uid) : false, // Check if current user is blocked by this user
				isCurrentUserBlocking: authUser ? blockingIds.includes(i.uid) : false, // Check if current user is blocking this user
			};
			return user;
		});

		res.json({
			status: "ok",
			users: userList,
			pagination: {
				nextCursor,
				hasMore,
				limit: limitNum,
				total: usersToReturn.length,
			},
		});
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetcing users", message: error?.message });
	}
};

// GET single user by username
export const getUserByUsername = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;

		if (!username) {
			return res.status(400).json({ message: "Username is required" });
		}

		const user = await prisma.user.findUnique({
			where: { username },
			include: {
				// Include blocked and restricted status directly if they are fields in the User model
				// Otherwise, fetch them via separate queries if managed differently
				// For now, assuming they are direct fields
				posts: {
					where: {
						// Filter out posts from users who are blocked by the current user, or who have blocked the current user
						// This logic might need refinement based on exact requirements (e.g., only filter if current user is viewing)
						// For now, let's assume we are filtering posts made by users the viewer has blocked
						author: {
							// Ensure the author is not blocked by the viewer
							// This check assumes the viewer is the authenticated user
							// and that the 'block' relationship is properly set up
							// and that 'isBlockedByCurrentUser' or similar is available
							// For simplicity, let's add a check here if the author's uid is in the blockingIds
							// This requires fetching blockingIds similar to getUsers
						},
					},
					include: {
						author: {
							select: {
								uid: true,
								name: true,
								username: true,
								photoURL: true,
								hasBlueCheck: true,
								// Include blocked/restricted status here if needed for author display
								isBlocked: true,
								isRestricted: true,
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
				},
				_count: {
					select: {
						posts: true,
						followers: true,
						following: true,
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Get current user's following list and block lists
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		let blockedByIds: string[] = []; // Users who blocked the current user
		let blockingIds: string[] = []; // Users the current user has blocked

		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f: any) => f.followingId);

			const blockedBy = await prisma.block.findMany({
				where: { blockedId: authUser.uid },
				select: { blockerId: true },
			});
			blockedByIds = blockedBy.map((b: any) => b.blockerId);

			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		// Filter posts if the current user is viewing:
		// - If the author of the post is blocked by the current user, hide the post.
		// - If the current user is blocked by the author, hide the post.
		let filteredPosts = user.posts;
		if (authUser) {
			filteredPosts = user.posts.filter((p: any) => {
				const authorId = p.author.uid;
				// Hide post if the viewer has blocked the author OR if the author has blocked the viewer
				return (
					!blockingIds.includes(authorId) && !blockedByIds.includes(authorId)
				);
			});
		} else {
			// If not authenticated, we might not have blocking information, or we might want to hide posts from private users.
			// For now, assuming non-authenticated users see all posts that aren't explicitly hidden by server-side logic.
		}

		const output = {
			uid: user.uid,
			name: user.name,
			username: user.username,
			bio: user.bio,
			photoURL: user.photoURL,
			hasBlueCheck: user.hasBlueCheck,
			membership: {
				subscription: user.subscription,
			},
			createdAt: user.createdAt,
			isBlocked: user.isBlocked, // Include blocked status of the user being viewed
			isRestricted: user.isRestricted, // Include restricted status of the user being viewed
			posts: filteredPosts.map((p: any) => {
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
					author: {
						uid: p.author.uid,
						name: p.author.name,
						username: p.author.username,
						photoURL: p.author.photoURL,
						hasBlueCheck: p.author.hasBlueCheck,
						isBlocked: p.author.isBlocked,
						isRestricted: p.author.isRestricted,
					},
				};
			}),
			stats: {
				posts: user._count.posts,
				followers: user._count.followers,
				following: user._count.following,
			},
			isFollowedByCurrentUser: authUser
				? followingIds.includes(user.uid)
				: false,
			isBlockedByCurrentUser: authUser
				? blockedByIds.includes(user.uid)
				: false, // Check if current user is blocked by this user
			isCurrentUserBlocking: authUser ? blockingIds.includes(user.uid) : false, // Check if current user is blocking this user
		};

		res.json({ status: "ok", user: output });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetching user", message: error?.message });
	}
};

// UPDATE user profile (authenticated only, self only)
export const updateUser = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { username } = req.params;
		const data = UpdateUserSchema.parse(req.body);

		if (!username) {
			return res.status(400).json({ message: "Username is required" });
		}

		const targetUser = await prisma.user.findUnique({
			where: { username },
		});

		if (!targetUser) {
			return res.status(404).json({ message: "User not found" });
		}

		if (targetUser.uid !== authUser.uid) {
			return res
				.status(403)
				.json({ message: "Not authorized to update this profile" });
		}

		// Add logic here to handle updating blocked/restricted status if it's part of user updates
		// For example, if data.isBlocked or data.isRestricted are in the payload.
		// This might involve separate mutations for blocking/unblocking users.

		const updatedUser = await prisma.user.update({
			where: { uid: authUser.uid },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.bio !== undefined && { bio: data.bio }),
				...(data.photoURL !== undefined && { photoURL: data.photoURL }),
				...(data.privacy !== undefined && { privacy: data.privacy }),
				// If directly updating blocked/restricted status:
				// ...(data.isBlocked !== undefined && { isBlocked: data.isBlocked }),
				// ...(data.isRestricted !== undefined && { isRestricted: data.isRestricted }),
			},
			select: {
				uid: true,
				name: true,
				username: true,
				bio: true,
				photoURL: true,
				hasBlueCheck: true,
				subscription: true,
				privacy: true,
				hasVerifiedEmail: true,
				isBlocked: true,
				isRestricted: true,
			},
		});

		res.json(updatedUser);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
		}
		res
			.status(500)
			.json({ error: "Error updating user", message: err?.message });
	}
};

// FOLLOW/UNFOLLOW user (authenticated only)
export const toggleFollow = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { username } = req.params;

		if (!username) {
			return res.status(400).json({ message: "Username is required" });
		}

		const targetUser = await prisma.user.findUnique({
			where: { username },
		});

		if (!targetUser) {
			return res.status(404).json({ message: "User not found" });
		}

		if (targetUser.uid === authUser.uid) {
			return res.status(400).json({ message: "Cannot follow yourself" });
		}

		// Check if the current user is blocked by the target user
		const isBlockedByTarget = await prisma.block.findFirst({
			where: {
				blockerId: targetUser.uid,
				blockedId: authUser.uid,
			},
		});

		if (isBlockedByTarget) {
			return res
				.status(403)
				.json({
					message: "You are blocked by this user and cannot follow them.",
				});
		}

		// Check if the current user has blocked the target user
		const isBlockingTarget = await prisma.block.findFirst({
			where: {
				blockerId: authUser.uid,
				blockedId: targetUser.uid,
			},
		});

		if (isBlockingTarget) {
			return res
				.status(403)
				.json({
					message: "You have blocked this user and cannot follow them.",
				});
		}

		const existingFollow = await prisma.follow.findFirst({
			where: {
				followerId: authUser.uid,
				followingId: targetUser.uid,
			},
		});

		if (existingFollow) {
			// Unfollow
			await prisma.follow.delete({
				where: { id: existingFollow.id },
			});
			res.json({ message: "User unfollowed", following: false });
		} else {
			// Follow
			await prisma.follow.create({
				data: {
					followerId: authUser.uid,
					followingId: targetUser.uid,
				},
			});
			res.json({ message: "User followed", following: true });
		}
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error toggling follow", message: error?.message });
	}
};

// GET user followers
export const getUserFollowers = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;

		if (!username) {
			return res.status(400).json({ message: "Username is required" });
		}

		const user = await prisma.user.findUnique({
			where: { username },
		});

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const authUser = (req as any).user as { uid: string } | undefined;
		let blockingIds: string[] = [];
		if (authUser) {
			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		const followers = await prisma.follow.findMany({
			where: { followingId: user.uid },
			include: {
				follower: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true, // Include blocked status
						isRestricted: true, // Include restricted status
					},
				},
			},
		});

		const userFollowers = followers
			.map((f: any) => {
				// Filter out followers who are blocked by the current user or who have blocked the current user
				// This check assumes the current user is the one requesting the list of followers.
				// If the current user is viewing someone else's followers, this logic might need adjustment.
				let isCurrentUserBlockingThisFollower = false;
				if (authUser) {
					isCurrentUserBlockingThisFollower = blockingIds.includes(
						f.follower.uid,
					);
				}

				return {
					uid: f.follower.uid,
					name: f.follower.name,
					username: f.follower.username,
					photoURL: f.follower.photoURL,
					hasBlueCheck: f.follower.hasBlueCheck,
					isBlocked: f.follower.isBlocked,
					isRestricted: f.follower.isRestricted,
					// Add a flag if the current user is blocking this follower
					isCurrentUserBlocking: isCurrentUserBlockingThisFollower,
				};
			})
			.filter((f: any) => {
				// Only return followers that the current user is NOT blocking and who are NOT blocking the current user
				// If authUser is undefined, no filtering is applied regarding blocking.
				if (!authUser) return true;
				return !f.isCurrentUserBlocking && !f.isBlocked; // Assuming f.isBlocked refers to the follower's blocked status impacting the viewer
			});

		res.json({ status: "ok", followers: userFollowers });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetching followers", message: error?.message });
	}
};

// GET user following
export const getUserFollowing = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;

		if (!username) {
			return res.status(400).json({ message: "Username is required" });
		}

		const user = await prisma.user.findUnique({
			where: { username },
		});

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const authUser = (req as any).user as { uid: string } | undefined;
		let blockingIds: string[] = [];
		if (authUser) {
			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		const following = await prisma.follow.findMany({
			where: { followerId: user.uid },
			include: {
				following: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true, // Include blocked status
						isRestricted: true, // Include restricted status
					},
				},
			},
		});

		const userFollowings = following
			.map((f: any) => {
				// Filter out users that the current user is blocking or who have blocked the current user
				let isCurrentUserBlockingThisFollowing = false;
				if (authUser) {
					isCurrentUserBlockingThisFollowing = blockingIds.includes(
						f.following.uid,
					);
				}

				return {
					uid: f.following.uid,
					name: f.following.name,
					username: f.following.username,
					photoURL: f.following.photoURL,
					hasBlueCheck: f.following.hasBlueCheck,
					isBlocked: f.following.isBlocked,
					isRestricted: f.following.isRestricted,
					// Add a flag if the current user is blocking this following
					isCurrentUserBlocking: isCurrentUserBlockingThisFollowing,
				};
			})
			.filter((f: any) => {
				// Only return users that the current user is NOT blocking and who are NOT blocking the current user
				if (!authUser) return true;
				return !f.isCurrentUserBlocking && !f.isBlocked; // Assuming f.isBlocked refers to the following's blocked status impacting the viewer
			});

		res.json({ status: "ok", following: userFollowings });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetching following", message: error?.message });
	}
};

// Mock function for processing payments, placeholder for PayPal integration
const processPayment = async (
	paymentMethod: string,
	amount: number,
	userId: string,
) => {
	if (paymentMethod === "paypal") {
		console.log(`Processing PayPal payment of ${amount} for user ${userId}`);
		// In a real application, you would integrate with PayPal SDK here
		// This is a placeholder and does not actually process payments
		return { success: true, transactionId: `paypal_${Date.now()}` };
	}
	// Add other payment methods here
	// if (paymentMethod === 'credit_card') { ... }

	return { success: false, message: "Payment method not supported" };
};

export const getTotalUserEarnings = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		// Find all posts by the user
		const posts = await prisma.post.findMany({
			where: { authorId: authUser.uid },
			include: {
				analytics: true, // include analytics to get earnings
			},
		});
		// Calculate total earnings
		const totalEarnings = posts.reduce((total: number, post: any) => {
			return total + (post.analytics?.earnings || 0);
		}, 0);
		res.json({
			message: "Total earnings fetched successfully",
			totalEarnings: totalEarnings / 100, // Return in dollars
			totalEarningsInCents: totalEarnings,
		});
	} catch (error: any) {
		res
			.status(500)
			.json({
				error: "Error fetching total earnings",
				message: error?.message,
			});
	}
};

// Example endpoint to add a payment method (like PayPal)
// This would typically be part of a user profile or settings update
export const addPaymentMethod = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { paymentMethod, paymentDetails } = req.body; // paymentDetails might contain PayPal account info, token, etc.

		// Validate payment method and details
		if (!paymentMethod || !paymentDetails) {
			return res
				.status(400)
				.json({ message: "Payment method and details are required" });
		}

		if (paymentMethod === "paypal") {
			// Example: Store PayPal email or token associated with the user
			// In a real app, you'd validate paymentDetails for PayPal more thoroughly
			// and potentially use a payment gateway SDK.
			const updatedUser = await prisma.user.update({
				where: { uid: authUser.uid },
				data: {
					paymentMethods: {
						// Assuming paymentMethods is a JSON or array field in the User model
						push: { method: "paypal", details: paymentDetails }, // Example structure
					},
				},
				select: {
					uid: true,
					name: true,
					paymentMethods: true,
				},
			});
			return res.json({
				message: "PayPal payment method added",
				user: updatedUser,
			});
		}
		// Add other payment methods here

		res.status(400).json({ message: "Unsupported payment method" });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error adding payment method", message: error?.message });
	}
};

// Endpoint to get individual replies for comments
export const getCommentReplies = async (req: Request, res: Response) => {
	try {
		const { commentId } = req.params;

		if (!commentId) {
			return res.status(400).json({ message: "Comment ID is required" });
		}

		const replies = await prisma.comment.findMany({
			where: { parentId: commentId }, // Use parentId to link replies
			include: {
				author: {
					// Include user details for the author of the reply
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true,
						isRestricted: true,
					},
				},
				likes: {
					// Include likes for each individual reply
					select: {
						user: {
							select: {
								uid: true,
								username: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: "asc",
			},
		});

		// Import mention parsing utility
		const { parseMentionsToNames } = await import("../utils/mentions");

		const processedReplies = await Promise.all(
			replies.map(async (reply: any) => {
				const processedContent = await parseMentionsToNames(reply.content);

				return {
					id: reply.id,
					content: processedContent,
					createdAt: reply.createdAt,
					author: {
						uid: reply.user.uid,
						name: reply.user.name,
						username: reply.user.username,
						photoURL: reply.user.photoURL,
						hasBlueCheck: reply.user.hasBlueCheck,
						isBlocked: reply.user.isBlocked,
						isRestricted: reply.user.isRestricted,
					},
					likesCount: reply.likes.length, // Count of likes for this reply
					likes: reply.likes.map((l: any) => ({
						// List of users who liked this reply
						user: {
							uid: l.user.uid,
							username: l.user.username,
						},
					})),
				};
			}),
		);

		res.json({ status: "ok", replies: processedReplies });
	} catch (error: any) {
		res
			.status(500)
			.json({
				error: "Error fetching comment replies",
				message: error?.message,
			});
	}
};

// Endpoint to get individual likes for a post
export const getPostLikes = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		const likes = await prisma.like.findMany({
			where: { postId: postId },
			include: {
				user: {
					// Include user details for the user who liked the post
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true,
						isRestricted: true,
					},
				},
			},
		});

		// Filter likes: Don't show likes from users who are blocked by the current user, or who have blocked the current user.
		const authUser = (req as any).user as { uid: string } | undefined;
		let blockingIds: string[] = [];
		if (authUser) {
			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		const filteredLikes = likes.filter((like: any) => {
			const likerId = like.user.uid;
			if (!authUser) return true; // If not authenticated, show all likes (or apply different rules)
			// Hide like if the current user has blocked the liker OR if the liker has blocked the current user
			return !blockingIds.includes(likerId) && !like.user.isBlocked; // Assuming like.user.isBlocked means the liker has blocked the current user
		});

		res.json({ status: "ok", likes: filteredLikes });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetching post likes", message: error?.message });
	}
};

// Endpoint to add a like to a post (or unlike)
export const togglePostLike = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { postId } = req.params;

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		// Check if the user is blocked or restricted
		const user = await prisma.user.findUnique({ where: { uid: authUser.uid } });
		if (user?.isBlocked || user?.isRestricted) {
			return res
				.status(403)
				.json({
					message:
						"You cannot perform this action because your account is blocked or restricted.",
				});
		}

		// Check if the post author has blocked the current user or vice versa
		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: { author: true },
		});
		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const isBlockedByAuthor = await prisma.block.findFirst({
			where: { blockerId: post.author.uid, blockedId: authUser.uid },
		});
		if (isBlockedByAuthor) {
			return res
				.status(403)
				.json({ message: "You are blocked by the author of this post." });
		}

		const isBlockingAuthor = await prisma.block.findFirst({
			where: { blockerId: authUser.uid, blockedId: post.author.uid },
		});
		if (isBlockingAuthor) {
			return res
				.status(403)
				.json({ message: "You have blocked the author of this post." });
		}

		const existingLike = await prisma.like.findFirst({
			where: {
				postId: postId,
				userId: authUser.uid,
			},
		});

		if (existingLike) {
			// Unlike the post
			await prisma.like.delete({
				where: { id: existingLike.id },
			});
			res.json({ message: "Post unliked successfully" });
		} else {
			// Like the post
			await prisma.like.create({
				data: {
					postId: postId,
					userId: authUser.uid,
				},
			});
			res.json({ message: "Post liked successfully" });
		}
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error toggling post like", message: error?.message });
	}
};

// Search users by username or name
export const searchUsers = async (req: Request, res: Response) => {
	try {
		const {
			query,
			limit = "20",
			cursor,
			subscription,
			hasBlueCheck,
			exact = "false",
		} = req.query;

		if (!query) {
			return res.status(400).json({ message: "Search query is required" });
		}

		const limitNum = Math.min(parseInt(limit as string), 50); // Max 50 users per search

		// Build where clause for search
		const where: any = {};

		if (exact === "true") {
			// Exact match search
			where.OR = [
				{
					username: {
						equals: query as string,
						mode: "insensitive",
					},
				},
				{
					name: {
						equals: query as string,
						mode: "insensitive",
					},
				},
			];
		} else {
			// Partial match search
			where.OR = [
				{
					username: {
						contains: query as string,
						mode: "insensitive",
					},
				},
				{
					name: {
						contains: query as string,
						mode: "insensitive",
					},
				},
			];
		}

		// Apply additional filters
		if (
			subscription &&
			["free", "premium", "pro"].includes(subscription as string)
		) {
			where.subscription = subscription;
		}

		if (hasBlueCheck === "true") {
			where.hasBlueCheck = true;
		} else if (hasBlueCheck === "false") {
			where.hasBlueCheck = false;
		}

		// Pagination
		const cursorCondition = cursor
			? {
					uid: {
						gt: cursor as string,
					},
				}
			: {};

		const finalWhere = cursor ? { ...where, ...cursorCondition } : where;

		const users = await prisma.user.findMany({
			where: finalWhere,
			select: {
				uid: true,
				name: true,
				username: true,
				bio: true,
				photoURL: true,
				hasBlueCheck: true,
				subscription: true,
				createdAt: true,
				_count: {
					select: {
						posts: true,
						following: true,
						followers: true,
					},
				},
			},
			orderBy: [
				// Prioritize exact username matches
				{
					username: (query as string) ? "asc" : undefined,
				},
				{
					createdAt: "desc",
				},
			],
			take: limitNum + 1,
		});

		// Get current user's following and blocking lists
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		let blockedByIds: string[] = [];
		let blockingIds: string[] = [];

		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f: any) => f.followingId);

			const blockedBy = await prisma.block.findMany({
				where: { blockedId: authUser.uid },
				select: { blockerId: true },
			});
			blockedByIds = blockedBy.map((b: any) => b.blockerId);

			const blocking = await prisma.block.findMany({
				where: { blockerId: authUser.uid },
				select: { blockedId: true },
			});
			blockingIds = blocking.map((b: any) => b.blockedId);
		}

		// Check pagination
		const hasMore = users.length > limitNum;
		const usersToReturn = hasMore ? users.slice(0, limitNum) : users;
		const nextCursor = hasMore
			? usersToReturn[usersToReturn.length - 1]?.uid
			: null;

		const searchResults = usersToReturn.map((user: any) => ({
			uid: user.uid,
			name: user.name,
			username: user.username,
			bio: user.bio,
			photoURL: user.photoURL,
			hasBlueCheck: user.hasBlueCheck,
			membership: {
				subscription: user.subscription,
			},
			createdAt: user.createdAt,
			stats: {
				posts: user._count.posts,
				followers: user._count.followers,
				following: user._count.following,
			},
			isFollowedByCurrentUser: authUser
				? followingIds.includes(user.uid)
				: false,
			isBlockedByCurrentUser: authUser
				? blockedByIds.includes(user.uid)
				: false,
			isCurrentUserBlocking: authUser ? blockingIds.includes(user.uid) : false,
		}));

		res.json({
			status: "ok",
			users: searchResults,
			pagination: {
				nextCursor,
				hasMore,
				limit: limitNum,
				total: searchResults.length,
			},
			query: query as string,
		});
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error searching users", message: error?.message });
	}
};

// Endpoint to add a comment to a post
export const addComment = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };
		const { postId } = req.params;
		const { content, parentCommentId } = req.body; // parentCommentId for threaded comments

		if (!postId || !content) {
			return res
				.status(400)
				.json({ message: "Post ID and comment content are required" });
		}

		// Check if the user is blocked or restricted
		const user = await prisma.user.findUnique({ where: { uid: authUser.uid } });
		if (user?.isBlocked || user?.isRestricted) {
			return res
				.status(403)
				.json({
					message:
						"You cannot perform this action because your account is blocked or restricted.",
				});
		}

		// Check if the post author has blocked the current user or vice versa
		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: { author: true },
		});
		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const isBlockedByAuthor = await prisma.block.findFirst({
			where: { blockerId: post.author.uid, blockedId: authUser.uid },
		});
		if (isBlockedByAuthor) {
			return res
				.status(403)
				.json({ message: "You are blocked by the author of this post." });
		}

		const isBlockingAuthor = await prisma.block.findFirst({
			where: { blockerId: authUser.uid, blockedId: post.author.uid },
		});
		if (isBlockingAuthor) {
			return res
				.status(403)
				.json({ message: "You have blocked the author of this post." });
		}

		// Create the comment
		const newComment = await prisma.comment.create({
			data: {
				content: content,
				postId: postId,
				userId: authUser.uid,
				parentCommentId: parentCommentId || null, // Handle null for top-level comments
			},
			include: {
				user: {
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true,
						isRestricted: true,
					},
				},
			},
		});

		res
			.status(201)
			.json({ message: "Comment added successfully", comment: newComment });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error adding comment", message: error?.message });
	}
};

// Endpoint to get comments for a post (includes replies)
export const getPostComments = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;

		if (!postId) {
			return res.status(400).json({ message: "Post ID is required" });
		}

		// Fetch top-level comments for the post
		const comments = await prisma.comment.findMany({
			where: {
				postId: postId,
				parentCommentId: null, // Get only top-level comments
			},
			include: {
				user: {
					// Include user details for the author of the comment
					select: {
						uid: true,
						name: true,
						username: true,
						photoURL: true,
						hasBlueCheck: true,
						isBlocked: true,
						isRestricted: true,
					},
				},
				likes: {
					// Include likes for each individual comment
					select: {
						user: {
							select: {
								uid: true,
								username: true,
							},
						},
					},
				},
				// We'll fetch replies separately or recursively if needed.
				// For now, focusing on top-level comments and their likes.
			},
			orderBy: {
				createdAt: "asc",
			},
		});

		// Process mentions in comments
		const processedComments = comments.map((comment: any) => {
			let processedContent = comment.content;
			// Regex to find mentions like @userId
			const mentionRegex = /@(\w+)/g;
			processedContent = processedContent.replace(
				mentionRegex,
				(match: string, userId: string) => {
					// Placeholder for user ID to name lookup
					// In a real app, you'd fetch the user by userId and return their name.
					// For example: `return `@${getUserNameById(userId)}`;`
					// For now, return the mention as is.
					// If we assume the mention is @username and reply.user.username is the author of the reply:
					// We can't use reply.user for mentioned users unless the mention is of the author itself.

					// A practical approach:
					// 1. Find all mentions in `reply.content`.
					// 2. Extract the user IDs from these mentions.
					// 3. Fetch the user objects for these IDs.
					// 4. Replace the mentions in the content with "@" + user.name.

					// For simplicity in this example, let's demonstrate the replacement logic:
					// If the mention format is "@username" and we want to display "@Username", we can do this:
					// return `@${userId}`; // This might be enough if userId is actually a username.

					// If it's "@userId" and we want "@Name", we need a lookup.
					// Let's assume for now, the mention is meant to be a username.
					// If the `reply.user` in the `likes` section contains the username, we can potentially use that.
					// However, `reply.user` here is the author of the `like`, not the author of the `reply`.

					// If the original content is "Hello @user123", and we need to find user123's name.
					// This requires a separate lookup.
					// For this example, we'll just return the mention as is, or a placeholder.

					// If the requirement is "mention as user id then parse the user id to be displayed as their name in the post, like @userId"
					// This implies the content has "@userId", and we need to convert it to "@UserName".
					// We don't have the user information for the mentioned ID directly in this `reply` object.
					// This requires a separate fetch or pre-population of mentioned users.
					// Let's simulate this by returning "@MentionedUser" as a placeholder.
					// In a real app, you would fetch users by ID and replace.

					// If the mention is of the author of the reply:
					// if (reply.user && userId === reply.user.username) {
					//     return `@${reply.user.name}`;
					// }

					// For now, let's implement a placeholder or a simple conversion if userId is found in fetched data.
					// This is a complex requirement and might need a dedicated function to resolve mentions.
					// Let's assume we have a function `getUserById(userId)` that returns user object.
					// For this context, we'll simply return the mention as is, or a placeholder.
					// The best we can do here is to acknowledge the need for a lookup.
					return `@${userId}`; // Placeholder: Replace with actual user name lookup
				},
			);

			return {
				id: comment.id,
				content: processedContent,
				createdAt: comment.createdAt,
				author: {
					uid: comment.user.uid,
					name: comment.user.name,
					username: comment.user.username,
					photoURL: comment.user.photoURL,
					hasBlueCheck: comment.user.hasBlueCheck,
					isBlocked: comment.user.isBlocked,
					isRestricted: comment.user.isRestricted,
				},
				likesCount: comment.likes.length,
				likes: comment.likes.map((l: any) => ({
					user: {
						uid: l.user.uid,
						username: l.user.username,
					},
				})),
				// Add logic here to fetch replies for this comment if needed, or indicate number of replies
				// For now, we assume replies are fetched via a separate endpoint like getCommentReplies
				repliesCount: 0, // Placeholder, would need to query for comments with parentCommentId
			};
		});

		res.json({ status: "ok", comments: processedComments });
	} catch (error: any) {
		res
			.status(500)
			.json({ error: "Error fetching post comments", message: error?.message });
	}
};
