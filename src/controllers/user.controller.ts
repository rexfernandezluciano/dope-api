/** @format */

import { Request, Response } from "express";
import { PrismaClient, Subscription } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const UpdateUserSchema = z.object({
	name: z.string().min(1).optional(),
	bio: z.string().max(500).optional(),
	photoURL: z.string().url().optional(),
	privacy: z
		.object({
			profile: z.enum(["public", "private"]).optional(),
			comments: z.enum(["public", "followers", "private"]).optional(),
			sharing: z.boolean().optional(),
			chat: z.enum(["public", "followers", "private"]).optional(),
		})
		.optional(),
});

// GET all users
export const getUsers = async (req: Request, res: Response) => {
	try {
		const users = await prisma.user.findMany({
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
						followers: true,
						following: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Get current user's following list for isFollowedByCurrentUser check
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f) => f.followingId);
		}

		const userList = users.map((i) => {
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
				stats: {
					posts: i._count.posts,
					followers: i._count.followers,
					following: i._count.following,
				},
				isFollowedByCurrentUser: authUser
					? followingIds.includes(i.uid)
					: false,
			};
			return user;
		});

		res.json({ status: "ok", users: userList });
	} catch (error) {
		res.status(500).json({ error: "Error fetcing users" });
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
			select: {
				uid: true,
				name: true,
				username: true,
				bio: true,
				photoURL: true,
				hasBlueCheck: true,
				subscription: true,
				createdAt: true,
				posts: {
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

		// Get current user's following list for isFollowedByCurrentUser check
		const authUser = (req as any).user as { uid: string } | undefined;
		let followingIds: string[] = [];
		if (authUser) {
			const following = await prisma.follow.findMany({
				where: { followerId: authUser.uid },
				select: { followingId: true },
			});
			followingIds = following.map((f) => f.followingId);
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
			posts: user.posts.map((p) => {
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
					author: {
						...p.author,
					},
				};
			}),
			likes: {
				user: {
					uid: user.uid,
					username: user.username,
				},
			},
			stats: {
				posts: user._count.posts,
				followers: user._count.followers,
				following: user._count.following,
			},
			isFollowedByCurrentUser: authUser
				? followingIds.includes(user.uid)
				: false,
		};

		res.json({ status: "ok", user: output });
	} catch (error) {
		res.status(500).json({ error: "Error fetching user" });
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

		const updatedUser = await prisma.user.update({
			where: { uid: authUser.uid },
			data: {
				...(data.name !== undefined && { name: data.name }),
				...(data.bio !== undefined && { bio: data.bio }),
				...(data.photoURL !== undefined && { photoURL: data.photoURL }),
				...(data.privacy !== undefined && { privacy: data.privacy }),
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
			},
		});

		res.json(updatedUser);
	} catch (err: any) {
		if (err.name === "ZodError") {
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
		}
		res.status(500).json({ error: "Error updating user" });
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
	} catch (error) {
		res.status(500).json({ error: "Error toggling follow" });
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
					},
				},
			},
		});

		const userFollowers = followers.map((f) => {
			return {
				uid: f.follower.uid,
				name: f.follower.name,
				username: f.follower.username,
				photoURL: f.follower.photoURL,
				hasBlueCheck: f.follower.hasBlueCheck,
			};
		});

		res.json({ status: "ok", followers: userFollowers });
	} catch (error) {
		res.status(500).json({ error: "Error fetching followers" });
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
					},
				},
			},
		});

		const userFollowings = following.map((f) => {
			return {
				uid: f.following.uid,
				name: f.following.name,
				username: f.following.username,
				photoURL: f.following.photoURL,
				hasBlueCheck: f.following.hasBlueCheck,
			};
		});

		res.json({ status: "ok", following: userFollowings });
	} catch (error) {
		res.status(500).json({ error: "Error fetching following" });
	}
};

// Get current user's posts
export const getCurrentUserPosts = async (req: Request, res: Response) => {
	try {
		const authUser = (req as any).user as { uid: string };

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
						hasBlueCheck: true
					}
				},
				likes: {
					select: {
						user: {
							select: {
								uid: true,
								username: true
							}
						}
					}
				},
				comments: {
					select: {
						id: true,
						content: true,
						createdAt: true,
						author: {
							select: {
								uid: true,
								name: true,
								username: true,
								photoURL: true,
								hasBlueCheck: true
							}
						}
					}
				},
				analytics: true, // Include analytics data if needed
				_count: {
					select: {
						comments: true,
						likes: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc", // Order posts by creation date
			},
		});

		const output = posts.map((p) => {
			return {
				id: p.id,
				content: p.content,
				imageUrls: p.imageUrls,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				stats: {
					comments: p._count.comments,
					likes: p._count.likes,
					earnings: p.analytics?.earnings || 0,
					views: p.analytics?.views || 0,
					shares: p.analytics?.shares || 0,
					clicks: p.analytics?.clicks || 0
				},
				author: {
					...p.author,
					isFollowedByCurrentUser: false
				},
				likes: p.likes.map((l) => {
					return {
						user: {
							uid: l.user.uid,
							username: l.user.username
						}
					}
				}),
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
				postType: p.postType,
				liveVideoUrl: p.liveVideoUrl,
				privacy: p.privacy
			}
		})

		res.json({ status: "ok", posts: output });
	} catch (error) {
		res.status(500).json({ error: "Error fetching user posts" });
	}
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
		const totalEarnings = posts.reduce((total, post) => {
			return total + (post.analytics?.earnings || 0);
		}, 0);
		res.json({
			message: "Total earnings fetched successfully",
			totalEarnings: totalEarnings / 100, // Return in dollars
			totalEarningsInCents: totalEarnings,
		});
	} catch (error) {
		res.status(500).json({ error: "Error fetching total earnings" });
	}
};
