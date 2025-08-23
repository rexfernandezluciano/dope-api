export const activityPubConfig = {
	domain: process.env.ACTIVITYPUB_DOMAIN || "api.dopp.eu.org",
	context: [
		"https://www.w3.org/ns/activitystreams",
		"https://w3id.org/security/v1",
	],
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
		shares: "/activitypub/users/:username/shares",
		likes: "/activitypub/users/:username/likes",
	},
	endpoints: {
		proxyUrl: "/activitypub/proxy",
		uploadMedia: "/activitypub/upload",
	},
};

export const getBaseUrl = (req: any) => {
	const protocol = req.http?.protocol;
	return `${protocol ?? "https"}:// ${activityPubConfig.domain}`;
};
