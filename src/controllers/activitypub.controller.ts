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
				photoURL: true,
				createdAt: true,
				followers: true,
				following: true,
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
			"@context": [
				"https://www.w3.org/ns/activitystreams",
				"https://w3id.org/security/v1",
				{
					"manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
					"toot": "http://dopp.eu.org",
					"featured": {
						"@id": "toot:featured",
						"@type": "@id"
					},
					"featuredTags": {
						"@id": "toot:featuredTags",
						"@type": "@id"
					},
					"alsoKnownAs": {
						"@id": "as:alsoKnownAs",
						"@type": "@id"
					},
					"movedTo": {
						"@id": "as:movedTo",
						"@type": "@id"
					},
					"schema": "http://schema.org#",
					"PropertyValue": "schema:PropertyValue",
					"value": "schema:value",
					"discoverable": "toot:discoverable",
					"suspended": "toot:suspended",
					"memorial": "toot:memorial",
					"indexable": "toot:indexable",
					"attributionDomains": {
						"@id": "toot:attributionDomains",
						"@type": "@id"
					},
					"focalPoint": {
						"@container": "@list",
						"@id": "toot:focalPoint"
					}
				}
			],
			id: `${baseUrl}/activitypub/users/${username}`,
			type: "Person",
			following: `${baseUrl}/activitypub/users/${username}/following`,
			followers: `${baseUrl}/activitypub/users/${username}/followers`,
			inbox: `${baseUrl}/activitypub/users/${username}/inbox`,
			outbox: `${baseUrl}/activitypub/users/${username}/outbox`,
			featured: `${baseUrl}/activitypub/users/${username}/collections/featured`,
			featuredTags: `${baseUrl}/activitypub/users/${username}/collections/tags`,
			preferredUsername: username,
			name: user.name || username,
			summary: user.bio ? `<p>${user.bio}</p>` : "",
			url: `${baseUrl}/@${username}`,
			manuallyApprovesFollowers: false,
			discoverable: true,
			indexable: true,
			published: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
			memorial: false,
			publicKey: {
				id: `${baseUrl}/activitypub/users/${username}#main-key`,
				owner: `${baseUrl}/activitypub/users/${username}`,
				publicKeyPem: publicKeyPem,
			},
			tag: [],
			attachment: [],
			endpoints: {
				sharedInbox: `${baseUrl}/activitypub/inbox`
			},
			icon: user.photoURL ? {
				type: "Image",
				mediaType: "image/jpeg",
				url: user.photoURL,
			} : undefined,
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
		const { page } = req.query;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true },
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Get total count of public posts
		const totalItems = await prisma.post.count({
			where: {
				authorId: user.uid,
				privacy: "public",
			},
		});

		// If no page parameter, return collection summary
		if (!page) {
			const outbox = {
				"@context": activityPubConfig.context,
				id: `${baseUrl}/activitypub/users/${username}/outbox`,
				type: "OrderedCollection",
				totalItems,
				first: totalItems > 0 ? `${baseUrl}/activitypub/users/${username}/outbox?page=1` : undefined,
				last: totalItems > 0 ? `${baseUrl}/activitypub/users/${username}/outbox?page=${Math.ceil(totalItems / 20)}` : undefined,
			};

			res.setHeader("Content-Type", "application/activity+json");
			return res.json(outbox);
		}

		// Handle paginated requests
		const pageNum = parseInt(page as string) || 1;
		const limit = 20;
		const offset = (pageNum - 1) * limit;

		// Get posts for this page
		const posts = await prisma.post.findMany({
			where: {
				authorId: user.uid,
				privacy: "public",
			},
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
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

		const totalPages = Math.ceil(totalItems / limit);
		const outboxPage = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}/outbox?page=${pageNum}`,
			type: "OrderedCollectionPage",
			partOf: `${baseUrl}/activitypub/users/${username}/outbox`,
			totalItems,
			orderedItems: await Promise.all(posts.map(async (post: any) => 
				await createPostActivity(post, author, baseUrl)
			)),
		};

		// Add navigation links
		if (pageNum > 1) {
			(outboxPage as any).prev = `${baseUrl}/activitypub/users/${username}/outbox?page=${pageNum - 1}`;
		}
		if (pageNum < totalPages) {
			(outboxPage as any).next = `${baseUrl}/activitypub/users/${username}/outbox?page=${pageNum + 1}`;
		}

		res.setHeader("Content-Type", "application/activity+json");
		res.json(outboxPage);
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

// Get featured posts collection
export const getFeatured = async (req: Request, res: Response) => {
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

		// Get featured/pinned posts (you can add a 'pinned' field to posts later)
		const featuredPosts = await prisma.post.findMany({
			where: {
				authorUid: user.uid,
				privacy: "public",
				// Add pinned: true when you implement pinning functionality
			},
			orderBy: { createdAt: "desc" },
			take: 5,
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

		const featured = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/collections/featured`,
			type: "OrderedCollection",
			totalItems: featuredPosts.length,
			orderedItems: await Promise.all(featuredPosts.map(async (post: any) => 
				await createPostActivity(post, author, baseUrl)
			)),
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(featured);
	} catch (error) {
		console.error("Error fetching featured collection:", error);
		res.status(500).json({ error: "Failed to fetch featured collection" });
	}
};

// Get featured tags collection
export const getFeaturedTags = async (req: Request, res: Response) => {
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

		// Get hashtags from user's posts (simplified implementation)
		const posts = await prisma.post.findMany({
			where: {
				authorUid: user.uid,
				privacy: "public",
			},
			select: {
				hashtags: true,
			},
		});

		// Extract unique hashtags
		const allHashtags = posts.flatMap((post: any) => post.hashtags || []);
		const uniqueHashtags = [...new Set(allHashtags)].slice(0, 10); // Top 10 hashtags

		const featuredTags = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/collections/tags`,
			type: "Collection",
			totalItems: uniqueHashtags.length,
			items: uniqueHashtags.map((tag: any) => ({
				type: "Hashtag",
				href: `${baseUrl}/tags/${tag.replace('#', '')}`,
				name: tag
			})),
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(featuredTags);
	} catch (error) {
		console.error("Error fetching featured tags:", error);
		res.status(500).json({ error: "Failed to fetch featured tags" });
	}
};

// Handle shared inbox for efficiency (used by Mastodon and other servers)
export const handleSharedInbox = async (req: Request, res: Response) => {
	try {
		const activity = req.body;

		// Verify content type
		const contentType = req.get('content-type');
		if (!contentType || !contentType.includes('application/activity+json')) {
			return res.status(400).json({ error: "Invalid content type" });
		}

		// Basic activity validation
		if (!activity.type || !activity.actor) {
			return res.status(400).json({ error: "Invalid activity" });
		}

		// For shared inbox, we need to determine the target user from the activity
		let targetUsername = null;

		if (activity.object && typeof activity.object === 'string') {
			// Extract username from object URL
			const match = activity.object.match(/\/activitypub\/users\/([^\/]+)/);
			if (match) {
				targetUsername = match[1];
			}
		} else if (activity.object?.attributedTo) {
			// For Create activities
			const match = activity.object.attributedTo.match(/\/activitypub\/users\/([^\/]+)/);
			if (match) {
				targetUsername = match[1];
			}
		}

		if (!targetUsername) {
			console.log("Could not determine target user for activity:", activity.type);
			return res.status(202).json({ message: "Activity processed" });
		}

		// Forward to user-specific inbox handling
		req.params = { username: targetUsername };
		return handleInbox(req, res);

	} catch (error) {
		console.error("Error handling shared inbox activity:", error);
		res.status(500).json({ error: "Failed to process activity" });
	}
};

// Get individual post as ActivityPub object
export const getPost = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const baseUrl = getBaseUrl(req);

		const post = await prisma.post.findUnique({
			where: { id },
			include: {
				author: {
					select: { username: true, name: true }
				}
			}
		});

		if (!post || post.privacy !== 'public') {
			return res.status(404).json({ error: "Post not found" });
		}

		const note = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/posts/${id}`,
			type: "Note",
			summary: null,
			content: post.content,
			attributedTo: `${baseUrl}/activitypub/users/${post.author.username}`,
			published: post.createdAt.toISOString(),
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			cc: [`${baseUrl}/activitypub/users/${post.author.username}/followers`],
			sensitive: false,
			tag: []
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(note);
	} catch (error) {
		console.error("Error fetching post:", error);
		res.status(500).json({ error: "Failed to fetch post" });
	}
};

// Get post activity
export const getPostActivity = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const baseUrl = getBaseUrl(req);

		const post = await prisma.post.findUnique({
			where: { id },
			include: {
				author: {
					select: { username: true, name: true }
				}
			}
		});

		if (!post || post.privacy !== 'public') {
			return res.status(404).json({ error: "Post not found" });
		}

		const activity = await createPostActivity(post, post.author, baseUrl);

		res.setHeader("Content-Type", "application/activity+json");
		res.json(activity);
	} catch (error) {
		console.error("Error fetching post activity:", error);
		res.status(500).json({ error: "Failed to fetch post activity" });
	}
};

// Get user's liked posts
export const getLiked = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Get liked posts
		const likedPosts = await prisma.like.findMany({
			where: { userUid: user.uid },
			include: {
				post: {
					include: {
						author: {
							select: { username: true }
						}
					}
				}
			},
			orderBy: { createdAt: 'desc' },
			take: 20
		});

		const liked = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/liked`,
			type: "OrderedCollection",
			totalItems: likedPosts.length,
			orderedItems: await Promise.all(likedPosts.map(async (like: any) => 
				await createPostActivity(like.post, like.post.author, baseUrl)
			))
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(liked);
	} catch (error) {
		console.error("Error fetching liked posts:", error);
		res.status(500).json({ error: "Failed to fetch liked posts" });
	}
};

// Get user collections
export const getCollection = async (req: Request, res: Response) => {
	try {
		const { username, id } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true }
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Handle different collection types
		if (id === 'featured') {
			return getFeatured(req, res);
		} else if (id === 'tags') {
			return getFeaturedTags(req, res);
		}

		// Default empty collection for unknown types
		const collection = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/collections/${id}`,
			type: "Collection",
			totalItems: 0,
			items: []
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(collection);
	} catch (error) {
		console.error("Error fetching collection:", error);
		res.status(500).json({ error: "Failed to fetch collection" });
	}
};

// Get blocked users
export const getBlocked = async (req: Request, res: Response) => {
	try {
		const { username } = req.params;
		const baseUrl = getBaseUrl(req);

		const user = await prisma.user.findUnique({
			where: { username },
			include: {
				blockedUsers: {
					select: {
						blocked: {
							select: { username: true }
						}
					}
				}
			}
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const blocked = {
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${baseUrl}/activitypub/users/${username}/blocked`,
			type: "Collection",
			totalItems: user.blockedUsers.length,
			items: user.blockedUsers.map((block: any) => 
				`${baseUrl}/activitypub/users/${block.blocked.username}`
			)
		};

		res.setHeader("Content-Type", "application/activity+json");
		res.json(blocked);
	} catch (error) {
		console.error("Error fetching blocked users:", error);
		res.status(500).json({ error: "Failed to fetch blocked users" });
	}
};

// Placeholder endpoints for ActivityPub compliance
export const getRejections = async (req: Request, res: Response) => {
	const { username } = req.params;
	const baseUrl = getBaseUrl(req);

	const rejections = {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activitypub/users/${username}/rejections`,
		type: "Collection",
		totalItems: 0,
		items: []
	};

	res.setHeader("Content-Type", "application/activity+json");
	res.json(rejections);
};

export const getRejected = async (req: Request, res: Response) => {
	const { username } = req.params;
	const baseUrl = getBaseUrl(req);

	const rejected = {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activitypub/users/${username}/rejected`,
		type: "Collection",
		totalItems: 0,
		items: []
	};

	res.setHeader("Content-Type", "application/activity+json");
	res.json(rejected);
};

export const getShares = async (req: Request, res: Response) => {
	const { username } = req.params;
	const baseUrl = getBaseUrl(req);

	const shares = {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activitypub/users/${username}/shares`,
		type: "Collection",
		totalItems: 0,
		items: []
	};

	res.setHeader("Content-Type", "application/activity+json");
	res.json(shares);
};

export const getLikes = async (req: Request, res: Response) => {
	const { username } = req.params;
	const baseUrl = getBaseUrl(req);

	const likes = {
		"@context": "https://www.w3.org/ns/activitystreams",
		id: `${baseUrl}/activitypub/users/${username}/likes`,
		type: "Collection",
		totalItems: 0,
		items: []
	};

	res.setHeader("Content-Type", "application/activity+json");
	res.json(likes);
};