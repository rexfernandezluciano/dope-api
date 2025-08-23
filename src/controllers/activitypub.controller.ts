
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
				publicKey: true,
				followersCount: true,
				followingCount: true,
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
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
				publicKeyPem: user.publicKey,
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

		// Get recent public posts
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

		const outbox = {
			"@context": activityPubConfig.context,
			id: `${baseUrl}/activitypub/users/${username}/outbox`,
			type: "OrderedCollection",
			totalItems: posts.length,
			orderedItems: posts.map((post: any) => ({
				id: `${baseUrl}/activitypub/posts/${post.id}/activity`,
				type: "Create",
				actor: `${baseUrl}/activitypub/users/${username}`,
				published: post.createdAt.toISOString(),
				object: {
					id: `${baseUrl}/activitypub/posts/${post.id}`,
					type: "Note",
					content: post.content,
					attributedTo: `${baseUrl}/activitypub/users/${username}`,
					published: post.createdAt.toISOString(),
				},
			})),
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
	// Store the follow relationship
	console.log(`${activity.actor} wants to follow ${user.username}`);
	
	// You can store federated follows in your database
	// For now, just log the activity
}

async function handleUnfollowActivity(activity: any, user: any) {
	console.log(`${activity.actor} unfollowed ${user.username}`);
	// Handle unfollow logic
}

async function handleLikeActivity(activity: any, user: any) {
	console.log(`${activity.actor} liked ${activity.object}`);
	// Handle like logic
}

async function handleCreateNoteActivity(activity: any, user: any) {
	console.log(`${activity.actor} mentioned ${user.username} in a note`);
	// Handle mention/reply logic
}
