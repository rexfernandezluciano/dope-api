import { Request, Response } from "express";
import { connect } from "../database/database";

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