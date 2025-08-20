/** @format */

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import passport from "passport";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });

	const token = header.slice(7);
	try {
		const payload = verifyToken(token);
		(req as any).user = payload;
		next();
	} catch {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });

	const token = header.slice(7);
	try {
		const payload = verifyToken(token);
		(req as any).user = payload;
		next();
	} catch {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		(req as any).user = null;
		return next();
	}

	const token = header.slice(7);
	try {
		const payload = verifyToken(token);
		(req as any).user = payload;
		next();
	} catch {
		(req as any).user = null;
		next();
	}
}

export function requireAuthJWT(req: Request, res: Response, next: NextFunction) {
	passport.authenticate("jwt", { session: false }, (err: any, user: any) => {
		if (err) {
			return res.status(500).json({ message: "Authentication error" });
		}
		if (!user) {
			return res.status(401).json({ message: "Invalid or expired token" });
		}
		(req as any).user = user;
		next();
	})(req, res, next);
}
