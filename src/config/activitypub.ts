import ActivitypubExpress from "activitypub-express";
import { connect } from "../database/database";

let prisma: any;

export const createActivityPubApp = async () => {
	if (!prisma) {
		prisma = await connect();
	}

	const apex = ActivitypubExpress({
		domain: "dopp.eu.org",
		context: [
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
		actorParam: "username",
		objectParam: "id",
		activityParam: "id",
		routes: {
			actor: "/activitypub/users/:username",
			object: "/activitypub/posts/:id",
			activity: "/activitypub/posts/:id/activity",
			inbox: "/activitypub/users/:username/inbox",
			outbox: "/activitypub/users/:username/outbox",
			followers: "/activitypub/users/:username/followers",
			following: "/activitypub/users/:username/following",
			liked: "/activitypub/users/:username/liked",
			collections: "/activitypub/users/:username/collections/:id",
			blocked: "/activitypub/users/:username/blocked",
			rejections: "/activitypub/users/:username/rejections",
			rejected: "/activitypub/users/:username/rejected",
			shares: "/activitypub/users/:username/shares"
		},
		endpoints: {
			proxyUrl: "/activitypub/proxy",
			uploadMedia: "/activitypub/upload",
		},
	});

	// Override actor resolution
	apex.resolveActor = async (username: string) => {
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

		if (!user) return null;

		const baseUrl = `${apex.domain.startsWith("localhost") ? "http" : "https"}://${apex.domain}`;
		const userUrl = `${baseUrl}/activitypub/users/${username}`;

		return {
			"@context": apex.context,
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
				: "",
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
	};

	// Override object resolution
	apex.resolveObject = async (id: string) => {
		const post = await prisma.post.findUnique({
			where: { id },
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

		if (!post || post.privacy !== "public") return null;

		const baseUrl = `${apex.domain.startsWith("localhost") ? "http" : "https"}://${apex.domain}`;
		const userUrl = `${baseUrl}/activitypub/users/${post.author.username}`;
		const postUrl = `${baseUrl}/activitypub/posts/${post.id}`;

		return {
			"@context": apex.context,
			id: postUrl,
			type: "Note",
			summary: null,
			content: post.content,
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
	};

	// Handle inbox activities
	apex.onActivity = async (activity: any, recipient: any) => {
		console.log(
			"Received activity:",
			activity.type,
			"for",
			recipient?.preferredUsername,
		);

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
		}
	};

	return apex;
};

// Keep existing utility functions
async function getOrCreateUserPublicKey(userId: string): Promise<string> {
	let userKeys = await prisma.userKeys?.findUnique({
		where: { userId },
	});

	if (!userKeys) {
		const crypto = await import("crypto");
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

async function handleFollowActivity(activity: any) {
	try {
		const actorUrl = activity.actor;
		const objectUrl = activity.object;

		const match = objectUrl.match(
			/\/(?:activitypub\/)?users\/(.+?)(?:[/?#]|$)/,
		);
		if (!match) return;

		const username = match[1];
		const user = await prisma.user.findUnique({
			where: { username },
			select: { uid: true, username: true },
		});

		if (!user) return;

		const existingFollow = await prisma.federatedFollow?.findUnique({
			where: {
				actorUrl_followingId: {
					actorUrl,
					followingId: user.uid,
				},
			},
		});

		if (existingFollow) return;

		await prisma.federatedFollow?.create({
			data: {
				actorUrl,
				followingId: user.uid,
				activityId: activity.id,
				createdAt: new Date(),
			},
		});

		console.log(`Created federated follow: ${actorUrl} -> ${user.username}`);
	} catch (error) {
		console.error("Error handling follow activity:", error);
	}
}

async function handleUnfollowActivity(activity: any) {
	try {
		const actorUrl = activity.actor;
		const followActivity = activity.object;

		await prisma.federatedFollow?.deleteMany({
			where: {
				actorUrl: actorUrl,
				activityId: followActivity.id,
			},
		});

		console.log(`Deleted federated follow: ${actorUrl}`);
	} catch (error) {
		console.error("Error handling unfollow activity:", error);
	}
}

async function handleLikeActivity(activity: any) {
	try {
		const objectUrl = activity.object;
		const actorUrl = activity.actor;

		const match = objectUrl.match(/\/(?:activitypub\/)?posts\/(.+)$/);
		if (!match) return;

		const postId = match[1];

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

async function handleCreateNoteActivity(activity: any) {
	try {
		const note = activity.object;
		const actorUrl = activity.actor;

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
