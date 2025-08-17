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

		const userList = users.map((i) => {
			const user = {
				uid: i.uid,
				name: i.name,
				username: i.username,
				bio: i.bio,
				photoURL: i.photoURL,
				hasBlueCheck: i.hasBlueCheck,
				subscription: i.subscription,
				createdAt: i.createdAt,
				stats: {
					posts: i._count.posts,
					followers: i._count.followers,
					following: i._count.following,
				},
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

		const output = {
			uid: user.uid,
			name: user.name,
			username: user.username,
			bio: user.bio,
			photoURL: user.photoURL,
			hasBlueCheck: user.hasBlueCheck,
			subscription: user.subscription,
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

		res.json(followers.map((f) => f.follower));
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

		res.json(following.map((f) => f.following));
	} catch (error) {
		res.status(500).json({ error: "Error fetching following" });
	}
};

// CREATE user (legacy function, keeping for compatibility)
export const createUser = async (req: Request, res: Response) => {
	try {
		const { name, email, username, photoURL, subscription, privacy } = req.body;

		if (!name || !email || !username || !photoURL) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const newUser = await prisma.user.create({
			data: {
				name,
				email,
				username,
				password: "temp_password", // Legacy function - consider requiring password in request
				photoURL,
				subscription: (subscription as Subscription) || "free",
				privacy: privacy || {
					profile: "public",
					comments: "public",
					sharing: true,
					chat: "public",
				},
			},
		});

		res.status(201).json(newUser);
	} catch (error) {
		res.status(500).json({ error: "Error creating user" });
	}
};
