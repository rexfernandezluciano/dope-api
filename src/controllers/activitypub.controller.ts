
import { Request, Response } from "express";
import { connect } from "../database/database";
import { parseMentionsToNames } from "../utils/mentions";
import crypto from "crypto";

let prisma: any;

(async () => {
	prisma = await connect();
})();

// WebFinger endpoint for user discovery
export const webfinger = async (req: Request, res: Response) => {
	try {
		const { resource } = req.query;
		
		if (!resource || typeof resource !== 'string') {
			return res.status(400).json({ error: "Missing resource parameter" });
		}

		// Parse acct:username@domain format
		const match = resource.match(/^acct:(.+)@(.+)$/);
		if (!match) {
			return res.status(400).json({ error: "Invalid resource format" });
		}

		const [, username, domain] = match;
		const expectedDomain = req.get('host');

		if (domain !== expectedDomain) {
			return res.status(404).json({ error: "User not found on this domain" });
		}

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true, name: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		
		res.json({
			subject: resource,
			links: [
				{
					rel: "self",
					type: "application/activity+json",
					href: `${baseUrl}/users/${username}`
				}
			]
		});
	} catch (error) {
		res.status(500).json({ error: "WebFinger lookup failed" });
	}
};

// Actor endpoint - returns user's ActivityPub profile
export const getActor = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		
		const user = await prisma.user.findUnique({
			where: { username },
			select: {
				uid: true,
				username: true,
				name: true,
				bio: true,
				photoURL: true,
				hasBlueCheck: true,
				createdAt: true,
				_count: {
					select: {
						posts: true,
						followers: true,
						following: true
					}
				}
			}
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const userUrl = `${baseUrl}/users/${username}`;

		const actor = {
			"@context": [
				"https://www.w3.org/ns/activitystreams",
				"https://w3id.org/security/v1"
			],
			id: userUrl,
			type: "Person",
			preferredUsername: user.username,
			name: user.name || user.username,
			summary: user.bio || "",
			icon: user.photoURL ? {
				type: "Image",
				mediaType: "image/jpeg",
				url: user.photoURL
			} : undefined,
			inbox: `${userUrl}/inbox`,
			outbox: `${userUrl}/outbox`,
			followers: `${userUrl}/followers`,
			following: `${userUrl}/following`,
			publicKey: {
				id: `${userUrl}#main-key`,
				owner: userUrl,
				publicKeyPem: await getOrCreateUserPublicKey(user.uid)
			},
			endpoints: {
				sharedInbox: `${baseUrl}/inbox`
			},
			published: user.createdAt.toISOString()
		};

		res.setHeader('Content-Type', 'application/activity+json');
		res.json(actor);
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve actor" });
	}
};

// Outbox endpoint - returns user's public posts
export const getOutbox = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const { page } = req.query;
		
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const outboxUrl = `${baseUrl}/users/${username}/outbox`;

		if (!page) {
			// Return outbox collection summary
			const postCount = await prisma.post.count({
				where: {
					authorId: user.uid,
					privacy: "public"
				}
			});

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: outboxUrl,
				type: "OrderedCollection",
				totalItems: postCount,
				first: `${outboxUrl}?page=1`
			});
		} else {
			// Return paginated posts
			const limit = 20;
			const offset = (parseInt(page as string) - 1) * limit;

			const posts = await prisma.post.findMany({
				where: {
					authorId: user.uid,
					privacy: "public"
				},
				include: {
					author: {
						select: {
							uid: true,
							username: true,
							name: true,
							photoURL: true
						}
					}
				},
				orderBy: { createdAt: "desc" },
				take: limit,
				skip: offset
			});

			const activities = await Promise.all(
				posts.map((post: any) => convertPostToActivity(post, baseUrl))
			);

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${outboxUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: outboxUrl,
				orderedItems: activities
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve outbox" });
	}
};

// Inbox endpoint - receives ActivityPub activities
export const postInbox = async (req: Request, res: Response) => {
	try {
		const activity = req.body;
		
		// Verify HTTP signature (simplified - you'd want proper verification)
		if (!await verifySignature(req)) {
			return res.status(401).json({ error: "Invalid signature" });
		}

		// Process different activity types
		switch (activity.type) {
			case "Follow":
				await handleFollowActivity(activity);
				break;
			case "Undo":
				if (activity.object?.type === "Follow") {
					await handleUnfollowActivity(activity);
				}
				break;
			case "Like":
				await handleLikeActivity(activity);
				break;
			case "Create":
				if (activity.object?.type === "Note") {
					await handleCreateNoteActivity(activity);
				}
				break;
			default:
				console.log(`Unsupported activity type: ${activity.type}`);
		}

		res.status(202).json({ message: "Activity accepted" });
	} catch (error) {
		console.error("Inbox processing error:", error);
		res.status(500).json({ error: "Failed to process activity" });
	}
};

// Convert internal post to ActivityPub Note
async function convertPostToActivity(post: any, baseUrl: string) {
	const userUrl = `${baseUrl}/users/${post.author.username}`;
	const postUrl = `${baseUrl}/posts/${post.id}`;

	// Parse mentions (@uid) to display names
	const processedContent = await parseMentionsToNames(post.content || "");

	return {
		id: `${postUrl}/activity`,
		type: "Create",
		actor: userUrl,
		published: post.createdAt.toISOString(),
		object: {
			id: postUrl,
			type: "Note",
			summary: null,
			content: processedContent,
			attributedTo: userUrl,
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			published: post.createdAt.toISOString(),
			attachment: post.imageUrls?.map((url: string) => ({
				type: "Image",
				mediaType: "image/jpeg",
				url: url
			})) || []
		}
	};
}

// Generate or retrieve user's cryptographic keys
async function getOrCreateUserPublicKey(userId: string): Promise<string> {
	// Check if user already has keys stored
	let userKeys = await prisma.userKeys?.findUnique({
		where: { userId }
	});

	if (!userKeys) {
		// Generate new RSA key pair
		const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem'
			}
		});

		// Store keys (you'll need to add UserKeys model to schema)
		userKeys = await prisma.userKeys?.create({
			data: {
				userId,
				publicKey,
				privateKey
			}
		});
	}

	return userKeys.publicKey;
}

// Simplified signature verification (implement proper HTTP signatures)
async function verifySignature(req: Request): Promise<boolean> {
	// This is a simplified version - implement proper HTTP signature verification
	// using the sender's public key from their actor endpoint
	return true;
}

// Handle incoming follow activity
async function handleFollowActivity(activity: any) {
	try {
		const actorUrl = activity.actor;
		const objectUrl = activity.object;
		
		// Extract username from object URL
		const match = objectUrl.match(/\/users\/(.+)$/);
		if (!match) return;
		
		const username = match[1];
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true }
		});

		if (!user) return;

		// Store the follow relationship (you might want to add a federated_follows table)
		await prisma.federatedFollow?.create({
			data: {
				actorUrl,
				followingId: user.uid,
				activityId: activity.id
			}
		});
	} catch (error) {
		console.error("Error handling follow activity:", error);
	}
}

// Handle unfollow activity
async function handleUnfollowActivity(activity: any) {
	try {
		const actorUrl = activity.actor;
		
		await prisma.federatedFollow?.delete({
			where: {
				actorUrl_activityId: {
					actorUrl,
					activityId: activity.object.id
				}
			}
		});
	} catch (error) {
		console.error("Error handling unfollow activity:", error);
	}
}

// Handle like activity
async function handleLikeActivity(activity: any) {
	try {
		const objectUrl = activity.object;
		const actorUrl = activity.actor;
		
		// Extract post ID from object URL
		const match = objectUrl.match(/\/posts\/(.+)$/);
		if (!match) return;
		
		const postId = match[1];
		
		// Store federated like
		await prisma.federatedLike?.create({
			data: {
				postId,
				actorUrl,
				activityId: activity.id
			}
		});
	} catch (error) {
		console.error("Error handling like activity:", error);
	}
}

// Handle create note activity (incoming posts)
async function handleCreateNoteActivity(activity: any) {
	try {
		const note = activity.object;
		const actorUrl = activity.actor;
		
		// Store federated post
		await prisma.federatedPost?.create({
			data: {
				actorUrl,
				content: note.content,
				activityId: activity.id,
				published: new Date(note.published)
			}
		});
	} catch (error) {
		console.error("Error handling create note activity:", error);
	}
}

// Get user followers collection
export const getFollowers = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const { page } = req.query;
		
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const followersUrl = `${baseUrl}/users/${username}/followers`;

		if (!page) {
			// Return followers collection summary
			const followerCount = await prisma.follow.count({
				where: { followingId: user.uid }
			});

			// Also count federated followers
			const federatedFollowerCount = await prisma.federatedFollow?.count({
				where: { followingId: user.uid }
			}) || 0;

			const totalFollowers = followerCount + federatedFollowerCount;

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: followersUrl,
				type: "OrderedCollection",
				totalItems: totalFollowers,
				first: `${followersUrl}?page=1`
			});
		} else {
			// Return paginated followers
			const limit = 20;
			const offset = (parseInt(page as string) - 1) * limit;

			// Get local followers
			const localFollowers = await prisma.follow.findMany({
				where: { followingId: user.uid },
				include: {
					follower: {
						select: { username: true }
					}
				},
				take: limit,
				skip: offset
			});

			// Get federated followers
			const federatedFollowers = await prisma.federatedFollow?.findMany({
				where: { followingId: user.uid },
				take: limit - localFollowers.length,
				skip: Math.max(0, offset - localFollowers.length)
			}) || [];

			const followers = [
				...localFollowers.map((f: any) => `${baseUrl}/users/${f.follower.username}`),
				...federatedFollowers.map((f: any) => f.actorUrl)
			];

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${followersUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: followersUrl,
				orderedItems: followers
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve followers" });
	}
};

// Get user following collection
export const getFollowing = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const { page } = req.query;
		
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const followingUrl = `${baseUrl}/users/${username}/following`;

		if (!page) {
			// Return following collection summary
			const followingCount = await prisma.follow.count({
				where: { followerId: user.uid }
			});

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: followingUrl,
				type: "OrderedCollection",
				totalItems: followingCount,
				first: `${followingUrl}?page=1`
			});
		} else {
			// Return paginated following
			const limit = 20;
			const offset = (parseInt(page as string) - 1) * limit;

			const following = await prisma.follow.findMany({
				where: { followerId: user.uid },
				include: {
					following: {
						select: { username: true }
					}
				},
				take: limit,
				skip: offset
			});

			const followingUrls = following.map((f: any) => `${baseUrl}/users/${f.following.username}`);

			res.setHeader('Content-Type', 'application/activity+json');
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${followingUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: followingUrl,
				orderedItems: followingUrls
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve following" });
	}
};
