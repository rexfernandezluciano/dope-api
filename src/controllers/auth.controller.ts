/** @format */

import { Request, Response, NextFunction } from "express";
import { Subscription, Credential } from "@prisma/client";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import {
	RegisterSchema,
	LoginSchema,
	VerifyEmailSchema,
	ResendCodeSchema,
} from "../utils/validate";
import { sendVerificationEmail } from "../utils/mailer";
import { signToken } from "../utils/jwt";
import { OAuth2Client } from "google-auth-library";
import { connect } from "../database/database";
import passport from "passport";

// Dynamic import functions for nanoid
const getMakeCode = async () => {
	const { customAlphabet } = await import("nanoid");
	return customAlphabet("0123456789", 6);
};

const getMakeVerificationId = async () => {
	const { customAlphabet } = await import("nanoid");
	return customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);
};

// Helper: decide BlueCheck from subscription
function computeBlueCheck(sub: Subscription) {
	return sub === "premium" || sub === "pro";
}

// Default privacy
const DEFAULT_PRIVACY = {
	profile: "public",
	comments: "public",
	sharing: true,
	chat: "public",
};

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
);

export const register = async (req: Request, res: Response) => {
	try {
		const parsed = RegisterSchema.parse(req.body);
		const { name, email, username, photoURL, password } = parsed;
		const subscription = (parsed.subscription ?? "free") as Subscription;
		const privacy = parsed.privacy ?? DEFAULT_PRIVACY;

		const db = await connect();

		const exists = await db.user.findUnique({ where: { email } });
		if (exists)
			return res.status(409).json({ message: "Email already registered" });

		const unameExists = await db.user.findUnique({ where: { username } });
		if (unameExists)
			return res.status(409).json({ message: "Username already taken" });

		const passwordHash = await bcrypt.hash(password, 12);

		const user = await db.user.create({
			data: {
				name,
				email,
				username,
				photoURL,
				password: passwordHash,
				subscription,
				hasBlueCheck: computeBlueCheck(subscription),
				privacy,
			},
		});

		await db.credential.create({
			data: {
				userId: user.uid,
				provider: "local",
				passwordHash,
			},
		});

		// Create verification record
		const makeCode = await getMakeCode();
		const makeVerificationId = await getMakeVerificationId();
		const code = makeCode();
		const verificationId = makeVerificationId();
		const expireAt = dayjs().add(15, "minute").toDate();

		await db.email.create({
			data: { email, code, verificationId, expireAt },
		});

		await sendVerificationEmail(email, code, verificationId);

		return res.status(201).json({
			message: "Registered. Check your email for the verification code.",
			verificationId,
			uid: user.uid,
		});
	} catch (err: any) {
		if (err.name === "ZodError")
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
		return res.status(500).json({ message: "Registration failed" });
	}
};

export const verifyEmail = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { email, code, verificationId } = VerifyEmailSchema.parse(req.body);

		const db = await connect();

		const record = await db.email.findUnique({ where: { verificationId } });
		if (!record || record.email !== email) {
			return res.status(400).json({ message: "Invalid verification request" });
		}
		if (dayjs(record.expireAt).isBefore(dayjs())) {
			return res.status(400).json({ message: "Verification code expired" });
		}
		if (record.code !== code) {
			return res.status(400).json({ message: "Incorrect verification code" });
		}

		await db.user.update({
			where: { email },
			data: { hasVerifiedEmail: true },
		});

		// Clean up all codes for this email
		await db.email.delete({ where: { verificationId } });
		await db.email.deleteMany({ where: { email } });

		return res.json({ message: "Email verified successfully" });
	} catch (err: any) {
		next(err);
	}
};

export const resendCode = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { email } = ResendCodeSchema.parse(req.body);

		const db = await connect();

		const user = await db.user.findUnique({ where: { email } });
		if (!user) return res.status(404).json({ message: "User not found" });
		if (user.hasVerifiedEmail)
			return res.status(400).json({ message: "Email already verified" });

		// Invalidate old codes
		await db.email.deleteMany({ where: { email } });

		// Create new code
		const makeCode = await getMakeCode();
		const makeVerificationId = await getMakeVerificationId();
		const code = makeCode();
		const verificationId = makeVerificationId();
		const expireAt = dayjs().add(15, "minute").toDate();

		await db.email.create({
			data: { email, code, verificationId, expireAt },
		});

		await sendVerificationEmail(email, code, verificationId);

		return res.json({ message: "Verification code resent", verificationId });
	} catch (err: any) {
		next(err);
	}
};

export const login = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	passport.authenticate("local", (err: any, user: any, info: any) => {
		if (err) {
			return next(err);
		}
		if (!user) {
			return res.status(401).json({ message: info.message || "Invalid credentials" });
		}

		req.logIn(user, (err) => {
			if (err) {
				return next(err);
			}

			const token = signToken({
				uid: user.uid,
				email: user.email,
				username: user.username,
			});

			return res.json({
				token,
				user: {
					uid: user.uid,
					name: user.name,
					email: user.email,
					username: user.username,
					photoURL: user.photoURL,
					hasBlueCheck: user.hasBlueCheck,
					membership: {
						subscription: user.subscription,
						nextBillingDate: user.nextBillingDate,
					},
					privacy: user.privacy,
					hasVerifiedEmail: user.hasVerifiedEmail,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		});
	})(req, res, next);
};

// Google Sign-in Controller
export const googleLogin = async (req: Request, res: Response) => {
	try {
		const { token: idToken } = req.body; // Get the ID token from the request body

		const db = await connect();

		if (!process.env.GOOGLE_CLIENT_ID) {
			return res
				.status(500)
				.json({ message: "Google Client ID not configured" });
		}

		// Verify the ID token
		const ticket = await googleClient.verifyIdToken({
			idToken: idToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();
		if (!payload || !payload.email || !payload.name) {
			return res.status(400).json({ message: "Invalid Google token" });
		}

		const { email, name, picture: photoURL } = payload;

		// Check if user already exists
		let user = await db.user.findUnique({ where: { email } });

		if (user) {
			// If user exists, log them in
			const token = signToken({
				uid: user.uid,
				email: user.email,
				username: user.username,
			});
			return res.json({
				token,
				user: {
					uid: user.uid,
					name: user.name,
					email: user.email,
					username: user.username,
					photoURL: user.photoURL,
					hasBlueCheck: user.hasBlueCheck,
					membership: {
						subscription: user.subscription,
						nextBillingDate: user.nextBillingDate,
					},
					privacy: user.privacy,
					hasVerifiedEmail: user.hasVerifiedEmail,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		} else {
			// If user doesn't exist, create a new user
			let username = email.split("@")[0] ?? ""; // Basic username generation

			// Ensure username is unique by checking if it exists
			let existingUser = await db.user.findUnique({ where: { username } });
			let counter = 1;
			while (existingUser) {
				username = `${email.split("@")[0]}_${counter}`;
				existingUser = await db.user.findUnique({ where: { username } });
				counter++;
			}

			const subscription = "free" as Subscription; // Default to free subscription
			const privacy = DEFAULT_PRIVACY;

			user = await db.user.create({
				data: {
					name,
					email,
					username,
					photoURL: photoURL || "",
					password: "", // No password for Google login
					subscription,
					hasBlueCheck: computeBlueCheck(subscription),
					privacy,
					hasVerifiedEmail: true, // Email is verified by Google
				},
			});

			await db.credential.create({
				data: {
					userId: user.uid,
					provider: "google",
				},
			});

			const token = signToken({
				uid: user.uid,
				email: user.email,
				username: user.username,
			});
			return res.status(201).json({
				token,
				user: {
					uid: user.uid,
					name: user.name,
					email: user.email,
					username: user.username,
					photoURL: user.photoURL,
					hasBlueCheck: user.hasBlueCheck,
					membership: {
						subscription: user.subscription,
						nextBillingDate: user.nextBillingDate,
					},
					privacy: user.privacy,
					hasVerifiedEmail: user.hasVerifiedEmail,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		}
	} catch (err: any) {
		if (err.name === "ZodError")
			return res
				.status(400)
				.json({ message: "Invalid payload", errors: err.errors });
		console.error("Google login error:", err); // Log the error for debugging
		return res.status(500).json({ message: "Google login failed" });
	}
};

export const me = async (req: Request, res: Response) => {
	const authUser = (req as any).user as { uid: string };

	const db = await connect();

	const user = await db.user.findUnique({
		where: { uid: authUser.uid },
		include: {
			followers: true,
			following: true,
			_count: {
				select: {
					posts: true,
					followers: true,
					following: true,
					likes: true,
				},
			},
		},
	});

	if (!user) return res.status(404).json({ message: "User not found" });
	const output = {
		uid: user.uid,
		name: user.name,
		email: user.email,
		bio: user.bio,
		username: user.username,
		photoURL: user.photoURL,
		hasBlueCheck: user.hasBlueCheck,
		membership: {
			subscription: user.subscription,
			nextBillingDate: user.nextBillingDate,
		},
		stats: {
			posts: user._count.posts,
			followers: user._count.followers,
			followings: user._count.following,
			likes: user._count.likes,
		},
		privacy: user.privacy,
		hasVerifiedEmail: user.hasVerifiedEmail,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
	return res.json({ status: "ok", user: output });
};

export const googleAuth = passport.authenticate("google", {
	scope: ["profile", "email"],
});

export const googleCallback = async (req: Request, res: Response, next: NextFunction) => {
	passport.authenticate("google", (err: any, user: any, info: any) => {
		if (err) {
			return next(err);
		}
		if (!user) {
			return res.redirect("/login?error=google_auth_failed");
		}

		req.logIn(user, (err) => {
			if (err) {
				return next(err);
			}

			const token = signToken({
				uid: user.uid,
				email: user.email,
				username: user.username,
			});

			// Redirect to frontend with token or return JSON
			return res.json({
				token,
				user: {
					uid: user.uid,
					name: user.name,
					email: user.email,
					username: user.username,
					photoURL: user.photoURL,
					hasBlueCheck: user.hasBlueCheck,
					membership: {
						subscription: user.subscription,
						nextBillingDate: user.nextBillingDate,
					},
					privacy: user.privacy,
					hasVerifiedEmail: user.hasVerifiedEmail,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		});
	})(req, res, next);
};

export const logout = async (req: Request, res: Response) => {
	req.logout((err) => {
		if (err) {
			return res.status(500).json({ message: "Logout failed" });
		}
		res.json({ message: "Logged out successfully" });
	});
};

export const validateVerificationId = async (req: Request, res: Response) => {
	const { verificationId } = req.params;

	const db = await connect();

	if (!verificationId) {
		return res.status(400).json({
			message: "Verification ID is required",
		});
	}

	const record = await db.email.findUnique({
		where: { verificationId },
	});

	if (!record) {
		return res.status(404).json({
			message: "Verification ID not found",
		});
	}

	const isExpired = dayjs(record.expireAt).isBefore(dayjs());

	if (isExpired)
		return res.status(400).json({
			message: "Verification code expired",
		});

	return res.json({
		message: "Verification ID is valid",
		email: record.email,
	});
};
