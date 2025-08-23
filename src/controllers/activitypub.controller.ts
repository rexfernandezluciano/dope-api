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

		const baseUrl = `${req.protocol}://${req.get("host")}/activitypub`;

		res.json({
			subject: resource,
			links: [
				{
					rel: "self",
					type: "application/activity+json",
					href: `${baseUrl}/users/${username}`,
				},
			],
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
						following: true,
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const userUrl = `${baseUrl}/activitypub/users/${username}`;

		const actor = {
			"@context": [
				"https://www.w3.org/ns/activitystreams",
				"https://w3id.org/security/v1",
				{
					manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
					toot: "http://joinmastodon.org/ns#",
					featured: {
						"@id": "toot:featured",
						"@type": "@id",
					},
					featuredTags: {
						"@id": "toot:featuredTags",
						"@type": "@id",
					},
					alsoKnownAs: {
						"@id": "as:alsoKnownAs",
						"@type": "@id",
					},
					movedTo: {
						"@id": "as:movedTo",
						"@type": "@id",
					},
					schema: "http://schema.org#",
					PropertyValue: "schema:PropertyValue",
					value: "schema:value",
					discoverable: "toot:discoverable",
					suspended: "toot:suspended",
					memorial: "toot:memorial",
					indexable: "toot:indexable",
					attributionDomains: {
						"@id": "toot:attributionDomains",
						"@type": "@id",
					},
					focalPoint: {
						"@container": "@list",
						"@id": "toot:focalPoint",
					},
				},
			],
			id: userUrl,
			type: "Person",
			preferredUsername: user.username,
			name: user.name || user.username,
			summary: user.bio || "",
			url: `${process.env.FRONTEND_URL ?? baseUrl}/@${user.username}`,
			manuallyApprovesFollowers: false,
			discoverable: true,
			indexable: true,
			published: user.createdAt.toISOString(),
			memorial: false,
			suspended: false,
			icon: user.photoURL
				? {
						type: "Image",
						mediaType: "image/jpeg",
						url: user.photoURL,
					}
				: undefined,
			inbox: `${userUrl}/inbox`,
			outbox: `${userUrl}/outbox`,
			followers: `${userUrl}/followers`,
			following: `${userUrl}/following`,
			featured: `${userUrl}/collections/featured`,
			featuredTags: `${userUrl}/collections/tags`,
			publicKey: {
				id: `${userUrl}#main-key`,
				owner: userUrl,
				publicKeyPem: await getOrCreateUserPublicKey(user.uid),
			},
			tag: [],
			attachment: [],
			endpoints: {
				sharedInbox: `${baseUrl}/activitypub/inbox`,
			},
		};

		res.setHeader("Content-Type", "application/activity+json");
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
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const outboxUrl = `${baseUrl}/activitypub/users/${username}/outbox`;

		if (!page) {
			// Return outbox collection summary
			const postCount = await prisma.post.count({
				where: {
					authorId: user.uid,
					privacy: "public",
				},
			});

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: outboxUrl,
				type: "OrderedCollection",
				totalItems: postCount,
				first: `${outboxUrl}?page=1`,
			});
		} else {
			// Return paginated posts
			const limit = 20;
			const offset = (parseInt(page as string) - 1) * limit;

			const posts = await prisma.post.findMany({
				where: {
					authorId: user.uid,
					privacy: "public",
				},
				include: {
					author: {
						select: {
							uid: true,
							username: true,
							name: true,
							photoURL: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
				take: limit,
				skip: offset,
			});

			const activities = await Promise.all(
				posts.map((post: any) => convertPostToActivity(post, baseUrl)),
			);

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${outboxUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: outboxUrl,
				orderedItems: activities,
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
		if (!(await verifySignature(req))) {
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
	const userUrl = `${baseUrl}/activitypub/users/${post.author.username}`;
	const postUrl = `${baseUrl}/activitypub/posts/${post.id}`;

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
			attachment:
				post.imageUrls?.map((url: string) => ({
					type: "Image",
					mediaType: "image/jpeg",
					url: url,
				})) || [],
		},
	};
}

// Generate or retrieve user's cryptographic keys
async function getOrCreateUserPublicKey(userId: string): Promise<string> {
	// Check if user already has keys stored
	let userKeys = await prisma.userKeys?.findUnique({
		where: { userId },
	});

	if (!userKeys) {
		// Generate new RSA key pair
		const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: "spki",
				format: "pem",
			},
			privateKeyEncoding: {
				type: "pkcs8",
				format: "pem",
			},
		});

		// Store keys (you'll need to add UserKeys model to schema)
		userKeys = await prisma.userKeys?.create({
			data: {
				userId,
				publicKey,
				privateKey,
			},
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

		console.log(`Processing follow activity: ${actorUrl} -> ${objectUrl}`);

		// Extract username from object URL - handle both /activitypub/users/ and /users/ patterns
		const match = objectUrl.match(
			/\/(?:activitypub\/)?users\/(.+?)(?:[/?#]|$)/,
		);
		if (!match) {
			console.log(`Could not extract username from object URL: ${objectUrl}`);
			return;
		}

		const username = match[1];
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) {
			console.log(`User not found: ${username}`);
			return;
		}

		// Check if this follow already exists
		const existingFollow = await prisma.federatedFollow?.findUnique({
			where: {
				actorUrl_followingId: {
					actorUrl,
					followingId: user.uid,
				},
			},
		});

		if (existingFollow) {
			console.log(`Follow already exists: ${actorUrl} -> ${user.username}`);
			return;
		}

		// Store the federated follow relationship
		const federatedFollow = await prisma.federatedFollow?.create({
			data: {
				actorUrl,
				followingId: user.uid,
				activityId: activity.id,
				createdAt: new Date(),
			},
		});

		console.log(`Created federated follow: ${actorUrl} -> ${user.username}`);

		// Send Accept activity back to the follower's inbox (Mastodon expects this)
		await sendAcceptActivity(activity, actorUrl, user);
	} catch (error) {
		console.error("Error handling follow activity:", error);
	}
}

// Send Accept activity for follow requests
async function sendAcceptActivity(
	followActivity: any,
	actorUrl: string,
	user: any,
) {
	try {
		// Fetch the remote actor to get their inbox
		const actorResponse = await fetch(actorUrl, {
			headers: {
				Accept: "application/activity+json",
			},
		});

		if (!actorResponse.ok) {
			console.error(`Failed to fetch actor: ${actorUrl}`);
			return;
		}

		const actor = await actorResponse.json();
		const inboxUrl = actor.inbox;

		if (!inboxUrl) {
			console.error(`No inbox found for actor: ${actorUrl}`);
			return;
		}

		const baseUrl =
			process.env.NODE_ENV === "production"
				? "https://dopp.eu.org"
				: "http://localhost:3000";

		const acceptActivity = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/activities/${crypto.randomUUID()}`,
			type: "Accept",
			actor: `${baseUrl}/activitypub/users/${user.username}`,
			object: followActivity,
		};

		// Send the Accept activity to the follower's inbox
		const response = await fetch(inboxUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/activity+json",
				Accept: "application/activity+json",
			},
			body: JSON.stringify(acceptActivity),
		});

		if (response.ok) {
			console.log(`Successfully sent Accept activity to ${inboxUrl}`);
		} else {
			console.error(
				`Failed to send Accept activity to ${inboxUrl}: ${response.status}`,
			);
		}
	} catch (error) {
		console.error("Error sending Accept activity:", error);
	}
}

// Handle unfollow activity
async function handleUnfollowActivity(activity: any) {
	try {
		const actorUrl = activity.actor;
		const followActivity = activity.object;

		console.log(`Processing unfollow activity: ${actorUrl}`);

		// Try to delete by actorUrl and original follow activity ID
		const deletedFollow = await prisma.federatedFollow?.deleteMany({
			where: {
				actorUrl: actorUrl,
				activityId: followActivity.id,
			},
		});

		// If that doesn't work, try deleting by actorUrl and the current user
		if (!deletedFollow || deletedFollow.count === 0) {
			const objectUrl = followActivity.object;
			const match = objectUrl?.match(
				/\/(?:activitypub\/)?users\/(.+?)(?:[/?#]|$)/,
			);

			if (match) {
				const username = match[1];
				const user = await prisma.user.findUnique({
					where: { username },
					select: { uid: true },
				});

				if (user) {
					await prisma.federatedFollow?.deleteMany({
						where: {
							actorUrl: actorUrl,
							followingId: user.uid,
						},
					});
					console.log(
						`Deleted federated follow by user lookup: ${actorUrl} -> ${username}`,
					);
				}
			}
		} else {
			console.log(`Deleted federated follow by activity ID: ${actorUrl}`);
		}
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
		const match = objectUrl.match(/\/(?:activitypub\/)?posts\/(.+)$/);
		if (!match) return;

		const postId = match[1];

		// Store federated like
		await prisma.federatedLike?.create({
			data: {
				postId,
				actorUrl,
				activityId: activity.id,
			},
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
				published: new Date(note.published),
			},
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
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const followersUrl = `${baseUrl}/activitypub/users/${username}/followers`;

		if (!page) {
			// Return followers collection summary
			const followerCount = await prisma.follow.count({
				where: { followingId: user.uid },
			});

			// Also count federated followers
			const federatedFollowerCount =
				(await prisma.federatedFollow?.count({
					where: { followingId: user.uid },
				})) || 0;

			const totalFollowers = followerCount + federatedFollowerCount;

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: followersUrl,
				type: "OrderedCollection",
				totalItems: totalFollowers,
				first: `${followersUrl}?page=1`,
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
						select: { username: true },
					},
				},
				take: limit,
				skip: offset,
			});

			// Get federated followers
			const remainingSlots = Math.max(0, limit - localFollowers.length);
			const federatedFollowers =
				remainingSlots > 0
					? (await prisma.federatedFollow?.findMany({
							where: { followingId: user.uid },
							take: remainingSlots,
							skip: Math.max(0, offset - localFollowers.length),
						})) || []
					: [];

			const followers = [
				...localFollowers.map(
					(f: any) => `${baseUrl}/activitypub/users/${f.follower.username}`,
				),
				...federatedFollowers.map((f: any) => f.actorUrl),
			];

			console.log(
				`Followers page ${page}: ${localFollowers.length} local + ${federatedFollowers.length} federated = ${followers.length} total`,
			);

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${followersUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: followersUrl,
				orderedItems: followers,
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve followers" });
	}
};

// Get individual post as ActivityPub Note
export const getPost = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;

		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				author: {
					select: {
						uid: true,
						username: true,
						name: true,
						photoURL: true,
					},
				},
			},
		});

		if (!post || post.privacy !== "public") {
			return res.status(404).json({ error: "Post not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const userUrl = `${baseUrl}/activitypub/users/${post.author.username}`;
		const postUrl = `${baseUrl}/activitypub/posts/${post.id}`;

		// Parse mentions (@uid) to display names
		const processedContent = await parseMentionsToNames(post.content || "");

		const note = {
			"@context": [
				"https://www.w3.org/ns/activitystreams",
				"https://w3id.org/security/v1",
			],
			id: postUrl,
			type: "Note",
			summary: null,
			content: processedContent,
			attributedTo: userUrl,
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			published: post.createdAt.toISOString(),
			attachment:
				post.imageUrls?.map((url: string) => ({
					type: "Image",
					mediaType: "image/jpeg",
					url: url,
				})) || [],
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(note);
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve post" });
	}
};

// Get post activity (Create activity wrapping the Note)
export const getPostActivity = async (req: Request, res: Response) => {
	try {
		const { postId } = req.params;

		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				author: {
					select: {
						uid: true,
						username: true,
						name: true,
						photoURL: true,
					},
				},
			},
		});

		if (!post || post.privacy !== "public") {
			return res.status(404).json({ error: "Post not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const activity = await convertPostToActivity(post, baseUrl);

		res.setHeader("Content-Type", "application/activity+json");
		res.json(activity);
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve post activity" });
	}
};

// Get featured posts collection (Mastodon compatibility)
export const getFeatured = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;

		// Get pinned/featured posts (you can implement pinning logic later)
		const featuredPosts = await prisma.post.findMany({
			where: {
				authorId: user.uid,
				privacy: "public",
				// Add pinned: true when you implement post pinning
			},
			include: {
				author: {
					select: {
						uid: true,
						username: true,
						name: true,
						photoURL: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 10,
		});

		const activities = await Promise.all(
			featuredPosts.map((post: any) => convertPostToActivity(post, baseUrl)),
		);

		res.setHeader("Content-Type", "application/activity+json");
		res.json({
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/collections/featured`,
			type: "OrderedCollection",
			totalItems: activities.length,
			orderedItems: activities,
		});
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve featured posts" });
	}
};

// Get featured tags collection (Mastodon compatibility)
export const getFeaturedTags = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;

		// Return empty collection for now (implement hashtag featuring later)
		res.setHeader("Content-Type", "application/activity+json");
		res.json({
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/collections/tags`,
			type: "OrderedCollection",
			totalItems: 0,
			orderedItems: [],
		});
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve featured tags" });
	}
};

// Get user following collection
export const getFollowing = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const { page } = req.query;

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const followingUrl = `${baseUrl}/activitypub/users/${username}/following`;

		if (!page) {
			// Return following collection summary
			const followingCount = await prisma.follow.count({
				where: { followerId: user.uid },
			});

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: followingUrl,
				type: "OrderedCollection",
				totalItems: followingCount,
				first: `${followingUrl}?page=1`,
			});
		} else {
			// Return paginated following
			const limit = 20;
			const offset = (parseInt(page as string) - 1) * limit;

			const following = await prisma.follow.findMany({
				where: { followerId: user.uid },
				include: {
					following: {
						select: { username: true },
					},
				},
				take: limit,
				skip: offset,
			});

			const followingUrls = following.map(
				(f: any) => `${baseUrl}/activitypub/users/${f.following.username}`,
			);

			res.setHeader("Content-Type", "application/activity+json");
			res.json({
				"@context": "https://www.w3.org/ns/activitystreams",
				id: `${followingUrl}?page=${page}`,
				type: "OrderedCollectionPage",
				partOf: followingUrl,
				orderedItems: followingUrls,
			});
		}
	} catch (error) {
		res.status(500).json({ error: "Failed to retrieve following" });
	}
};
