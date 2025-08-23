
import { Request, Response } from "express";
import { connect } from "../database/database";
import { activityPubConfig, getBaseUrl } from "../config/activitypub";
import crypto from "crypto";

let prisma: any;

(async () => {
	prisma = await connect();
})();

// WebFinger endpoint for user discovery
export const webfinger = async (req: Request, res: Response) => {
	try {
		const { resource } = req.query;

		if (!resource || typeof resource !== "string") {
			return res.status(400).json({ error: "Missing resource parameter" });
		}

		// Parse acct:username@domain format
		const match = resource.match(/^acct:(.+)@(.+)$/);
		if (!match) {
			return res.status(400).json({ error: "Invalid resource format" });
		}

		const [, username, domain] = match;

		if (!username || !domain) {
			return res.status(400).json({ error: "Invalid resource format" });
		}

		const expectedDomain = req.get("host");

		// Handle domain matching more flexibly
		const normalizedDomain = domain.toLowerCase();
		const normalizedExpected = expectedDomain?.toLowerCase();

		// Also check against known domain variants
		const knownDomains = ["dopp.eu.org", "api.dopp.eu.org"];
		const isDomainValid =
			normalizedDomain === normalizedExpected ||
			knownDomains.includes(normalizedDomain);

		if (!isDomainValid) {
			console.log(
				`Domain mismatch: requested=${normalizedDomain}, expected=${normalizedExpected}, host=${req.get("host")}`,
			);
			return res.status(404).json({ error: "User not found on this domain" });
		}

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true, name: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = getBaseUrl(req);

		res.json({
			subject: resource,
			links: [
				{
					rel: "self",
					type: "application/activity+json",
					href: `${baseUrl}/activitypub/users/${username}`,
				},
			],
		});
	} catch (error) {
		res.status(500).json({ error: "WebFinger lookup failed" });
	}
};

// Get user actor profile
export const getActor = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			select: {
				uid: true,
				username: true,
				name: true,
				bio: true,
				profilePic: true,
				followersCount: true,
				followingCount: true,
				userKeys: true
			}
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Generate keys if they don't exist
		let publicKeyPem = user.userKeys?.publicKey;
		if (!publicKeyPem) {
			const keyPair = crypto.generateKeyPairSync('rsa', {
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

			await prisma.userKeys.upsert({
				where: { userId: user.uid },
				update: {
					publicKey: keyPair.publicKey,
					privateKey: keyPair.privateKey
				},
				create: {
					userId: user.uid,
					publicKey: keyPair.publicKey,
					privateKey: keyPair.privateKey
				}
			});

			publicKeyPem = keyPair.publicKey;
		}

		const actor = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}`,
			type: "Person",
			preferredUsername: username,
			name: user.name,
			summary: user.bio || "",
			icon: user.profilePic ? {
				type: "Image",
				mediaType: "image/jpeg",
				url: user.profilePic,
			} : undefined,
			inbox: `${baseUrl}/activitypub/users/${username}/inbox`,
			outbox: `${baseUrl}/activitypub/users/${username}/outbox`,
			followers: `${baseUrl}/activitypub/users/${username}/followers`,
			following: `${baseUrl}/activitypub/users/${username}/following`,
			liked: `${baseUrl}/activitypub/users/${username}/liked`,
			publicKey: {
				id: `${baseUrl}/activitypub/users/${username}#main-key`,
				owner: `${baseUrl}/activitypub/users/${username}`,
				publicKeyPem: publicKeyPem,
			},
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(actor);
	} catch (error) {
		console.error("Error fetching actor:", error);
		res.status(500).json({ error: "Failed to fetch actor" });
	}
};

// Handle inbox activities
export const handleInbox = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const activity = req.body;

		// Verify the user exists
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Process different activity types
		switch (activity.type) {
			case "Follow":
				await handleFollowActivity(activity, user);
				break;
			case "Undo":
				if (activity.object?.type === "Follow") {
					await handleUnfollowActivity(activity, user);
				}
				break;
			case "Like":
				await handleLikeActivity(activity, user);
				break;
			case "Create":
				if (activity.object?.type === "Note") {
					await handleCreateNoteActivity(activity, user);
				}
				break;
			default:
				console.log(`Unhandled activity type: ${activity.type}`);
		}

		res.status(202).json({ message: "Activity processed" });
	} catch (error) {
		console.error("Error handling inbox activity:", error);
		res.status(500).json({ error: "Failed to process activity" });
	}
};

// Create outbound activity for a post
export const createPostActivity = async (post: any, author: any, baseUrl: string) => {
	return {
		id: `${baseUrl}/activitypub/posts/${post.id}/activity`,
		type: "Create",
		actor: `${baseUrl}/activitypub/users/${author.username}`,
		published: post.createdAt.toISOString(),
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: [`${baseUrl}/activitypub/users/${author.username}/followers`],
		object: {
			id: `${baseUrl}/activitypub/posts/${post.id}`,
			type: "Note",
			summary: null,
			content: post.content,
			attributedTo: `${baseUrl}/activitypub/users/${author.username}`,
			published: post.createdAt.toISOString(),
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			cc: [`${baseUrl}/activitypub/users/${author.username}/followers`],
			sensitive: false,
			tag: []
		}
	};
};

// Get user outbox
export const getOutbox = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Get recent public posts with author info
		const posts = await prisma.post.findMany({
			where: {
				authorUid: user.uid,
				privacy: "public",
			},
			orderBy: { createdAt: "desc" },
			take: 20,
			select: {
				id: true,
				content: true,
				createdAt: true,
			},
		});

		const author = await prisma.user.findUnique({
			where: { uid: user.uid },
			select: { username: true }
		});

		const outbox = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}/outbox`,
			type: "OrderedCollection",
			totalItems: posts.length,
			orderedItems: await Promise.all(posts.map(async (post: any) => 
				await createPostActivity(post, author, baseUrl)
			)),
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(outbox);
	} catch (error) {
		console.error("Error fetching outbox:", error);
		res.status(500).json({ error: "Failed to fetch outbox" });
	}
};

// Get followers collection
export const getFollowers = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			include: {
				followers: {
					select: {
						follower: {
							select: { username: true },
						},
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const followers = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}/followers`,
			type: "OrderedCollection",
			totalItems: user.followers.length,
			orderedItems: user.followers.map((f: any) => 
				`${baseUrl}/activitypub/users/${f.follower.username}`
			),
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(followers);
	} catch (error) {
		console.error("Error fetching followers:", error);
		res.status(500).json({ error: "Failed to fetch followers" });
	}
};

// Get following collection
export const getFollowing = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			include: {
				following: {
					select: {
						following: {
							select: { username: true },
						},
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const following = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}/following`,
			type: "OrderedCollection",
			totalItems: user.following.length,
			orderedItems: user.following.map((f: any) => 
				`${baseUrl}/activitypub/users/${f.following.username}`
			),
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(following);
	} catch (error) {
		console.error("Error fetching following:", error);
		res.status(500).json({ error: "Failed to fetch following" });
	}
};

// Activity handlers
async function handleFollowActivity(activity: any, user: any) {
	try {
		// Store the federated follow relationship
		console.log(`${activity.actor} wants to follow ${user.username}`);
		
		await prisma.federatedFollow.upsert({
			where: {
				actorUrl_activityId: {
					actorUrl: activity.actor,
					activityId: activity.id
				}
			},
			update: {},
			create: {
				actorUrl: activity.actor,
				followingId: user.uid,
				activityId: activity.id
			}
		});

		// Send Accept activity back to the follower
		const baseUrl = getBaseUrl({ protocol: 'https', get: () => activityPubConfig.domain });
		const acceptActivity = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/activities/${crypto.randomUUID()}`,
			type: "Accept",
			actor: `${baseUrl}/activitypub/users/${user.username}`,
			object: activity
		};

		// TODO: Send accept activity to actor's inbox
		console.log("Accept activity created:", acceptActivity);
		
	} catch (error) {
		console.error("Error handling follow activity:", error);
	}
}

async function handleUnfollowActivity(activity: any, user: any) {
	try {
		console.log(`${activity.actor} unfollowed ${user.username}`);
		
		// Remove the federated follow relationship
		await prisma.federatedFollow.deleteMany({
			where: {
				actorUrl: activity.actor,
				followingId: user.uid
			}
		});
		
	} catch (error) {
		console.error("Error handling unfollow activity:", error);
	}
}

async function handleLikeActivity(activity: any, user: any) {
	try {
		console.log(`${activity.actor} liked ${activity.object}`);
		
		// Extract post ID from the object URL
		const objectUrl = activity.object;
		const postIdMatch = objectUrl.match(/\/activitypub\/posts\/([^\/]+)$/);
		
		if (postIdMatch) {
			const postId = postIdMatch[1];
			
			// Check if the post exists and belongs to this user
			const post = await prisma.post.findFirst({
				where: {
					id: postId,
					authorUid: user.uid
				}
			});
			
			if (post) {
				// Store the federated like
				await prisma.federatedLike.upsert({
					where: {
						postId_actorUrl: {
							postId: postId,
							actorUrl: activity.actor
						}
					},
					update: {},
					create: {
						postId: postId,
						actorUrl: activity.actor,
						activityId: activity.id
					}
				});
			}
		}
		
	} catch (error) {
		console.error("Error handling like activity:", error);
	}
}

async function handleCreateNoteActivity(activity: any, user: any) {
	try {
		console.log(`${activity.actor} mentioned ${user.username} in a note`);
		
		const note = activity.object;
		
		// Store the federated post/note
		await prisma.federatedPost.upsert({
			where: {
				activityId: activity.id
			},
			update: {},
			create: {
				actorUrl: activity.actor,
				content: note.content || '',
				activityId: activity.id,
				published: new Date(note.published || activity.published || new Date())
			}
		});
		
		// TODO: Parse mentions and create notifications for mentioned users
		// TODO: Handle replies if this is a reply to a local post
		
	} catch (error) {
		console.error("Error handling create note activity:", error);
	}
}
