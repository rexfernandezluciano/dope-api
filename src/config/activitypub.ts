
import ActivitypubExpress from "activitypub-express";

export const createActivityPubApp = async () => {
	const apex = ActivitypubExpress({
		domain: "dopp.eu.org",
		context: [
			"https://www.w3.org/ns/activitystreams",
			"https://w3id.org/security/v1",
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
			shares: "/activitypub/users/:username/shares",
			likes: "/activitypub/users/:username/likes"
		},
		endpoints: {
			proxyUrl: "/activitypub/proxy",
			uploadMedia: "/activitypub/upload",
		},
	});

	return apex;
};
