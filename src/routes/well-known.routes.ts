import { Router, Request, Response } from "express";
import { getBaseUrl } from "../config/activitypub";
import { webfinger } from "../controllers/activitypub.controller";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// WebFinger endpoint for user discovery
router.get("/webfinger", asyncHandler(webfinger));

// OAuth Authorization Server Metadata (RFC 8414)
router.get(
	"/oauth-authorization-server",
	asyncHandler((req: Request, res: Response) => {
		const baseUrl = getBaseUrl(req);

		res.json({
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/oauth/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			revocation_endpoint: `${baseUrl}/oauth/revoke`,
			userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
			registration_endpoint: `${baseUrl}/oauth/apps`,
			scopes_supported: ["read", "write", "follow", "push"],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code"],
			code_challenge_methods_supported: ["S256", "plain"],
			token_endpoint_auth_methods_supported: ["client_secret_post"],
			service_documentation: `${baseUrl}/api/docs`,
			ui_locales_supported: ["en"],
		});
	}),
);

// NodeInfo Discovery endpoint
router.get(
	"/nodeinfo",
	asyncHandler((req: Request, res: Response) => {
		const baseUrl = getBaseUrl(req);

		res.json({
			links: [
				{
					rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
					href: `${baseUrl}/.well-known/nodeinfo/2.0`,
				},
			],
		});
	}),
);

// NodeInfo 2.0 endpoint
router.get(
	"/nodeinfo/2.0",
	asyncHandler(async (req: Request, res: Response) => {
		// You might want to fetch actual statistics from your database
		// For now, using placeholder values as shown in your API docs
		
		res.json({
			version: "2.0",
			software: {
				name: "dope-network",
				version: "1.0.0",
			},
			protocols: ["activitypub"],
			services: {
				outbound: [],
				inbound: [],
			},
			usage: {
				users: {
					total: 10000,
					activeMonth: 2500,
					activeHalfyear: 5000,
				},
				localPosts: 50000,
				localComments: 150000,
			},
			openRegistrations: true,
			metadata: {
				nodeName: "DOPE Network",
				nodeDescription: "A comprehensive social media platform",
			},
		});
	}),
);

// Host Meta endpoint
router.get(
	"/host-meta",
	asyncHandler((req: Request, res: Response) => {
		const baseUrl = getBaseUrl(req);

		res.set("Content-Type", "application/xrd+xml");
		res.send(`<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml" template="${baseUrl}/.well-known/webfinger?resource={uri}"/>
</XRD>`);
	}),
);

export default router;
