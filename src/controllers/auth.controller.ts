/** @format */

import { Request, Response, NextFunction } from "express";
import { Subscription } from "@prisma/client";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import {
	RegisterSchema,
	VerifyEmailSchema,
	ResendCodeSchema,
	ForgotPasswordSchema,
	ResetPasswordSchema,
	CheckUsernameSchema,
	CheckEmailSchema,
} from "../utils/validate";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/mailer";
import { signToken } from "../utils/jwt";
import { OAuth2Client } from "google-auth-library";
import { connect } from "../database/database";
import passport from "passport";

// Create the functions directly using crypto module
const makeCode = () => {
	return () => {
		let code = "";
		for (let i = 0; i < 6; i++) {
			code += Math.floor(Math.random() * 10).toString();
		}
		return code;
	};
};

const makeVerificationId = () => {
	const crypto = require("crypto");
	return () => {
		return crypto.randomBytes(12).toString("hex");
	};
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

export const register = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();

		const parsed = RegisterSchema.parse(req.body);
		const { name, email, username, photoURL, password } = parsed;
		const subscription = (parsed.subscription ?? "free") as Subscription;
		const privacy = parsed.privacy ?? DEFAULT_PRIVACY;

		const exists = await prisma.user.findUnique({ where: { email } });
		if (exists)
			return res.status(409).json({ message: "Email already registered" });

		// Check if username already exists and auto-suffix if needed
		let finalUsername = username;
		let counter = 1;
		let existingUsername = await prisma.user.findUnique({
			where: { username: finalUsername },
		});

		while (existingUsername) {
			finalUsername = `${username}${counter}`;
			existingUsername = await prisma.user.findUnique({
				where: { username: finalUsername },
			});
			counter++;
		}

		const passwordHash = await bcrypt.hash(password, 12);

		const user = await prisma.user.create({
			data: {
				name,
				email,
				username: finalUsername,
				photoURL: photoURL ?? "https://i.pravatar.cc/500",
				password: passwordHash,
				subscription,
				hasBlueCheck: computeBlueCheck(subscription),
				privacy,
			},
		});

		await prisma.credential.create({
			data: {
				userId: user.uid,
				provider: "local",
				passwordHash,
			},
		});

		// Create new code
		const code = makeCode()();
		const verificationId = makeVerificationId()();
		const expireAt = dayjs().add(15, "minute").toDate();

		await prisma.email.create({
			data: { email, code, verificationId, expireAt },
		});

		await sendVerificationEmail(email, code, verificationId);

		return res.status(201).json({
			message: "Registered. Check your email for the verification code.",
			verificationId,
			uid: user.uid,
		});
	} catch (err: any) {
		console.error("Registration error:", err);
		next(err);
	}
};

export const verifyEmail = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();
		const { email, code, verificationId } = VerifyEmailSchema.parse(req.body);

		const record = await prisma.email.findUnique({ where: { verificationId } });
		if (!record || record.email !== email) {
			return res.status(400).json({ message: "Invalid verification request" });
		}
		if (dayjs(record.expireAt).isBefore(dayjs())) {
			return res.status(400).json({ message: "Verification code expired" });
		}
		if (record.code !== code) {
			return res.status(400).json({ message: "Incorrect verification code" });
		}

		await prisma.user.update({
			where: { email },
			data: {
				hasVerifiedEmail: true,
				nextBillingDate: dayjs().add(30, "day").toDate(),
			},
		});

		// Clean up all codes for this email
		await prisma.email.delete({ where: { verificationId } });
		await prisma.email.deleteMany({ where: { email } });

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
		const prisma = await connect();
		const { email } = ResendCodeSchema.parse(req.body);

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(404).json({ message: "User not found" });
		if (user.hasVerifiedEmail)
			return res.status(400).json({ message: "Email already verified" });

		// Invalidate old codes
		await prisma.email.deleteMany({ where: { email } });

		// Create new code
		const codeGenerator = makeCode();
		const verificationIdGenerator = makeVerificationId();
		const code = codeGenerator();
		const verificationId = verificationIdGenerator();
		const expireAt = dayjs().add(15, "minute").toDate();

		await prisma.email.create({
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
	try {
		passport.authenticate("local", (err: any, user: any, info: any) => {
			if (err) {
				console.error("Authentication error:", err);
				return res.status(500).json({ message: "Authentication failed" });
			}
			if (!user) {
				return res
					.status(401)
					.json({ message: info.message || "Invalid credentials" });
			}

			req.logIn(user, async (err) => {
				if (err) {
					console.error("Login error:", err);
					return res
						.status(500)
						.json({ error: err.message, message: "Login failed" });
				}

				try {
					// Create session with device tracking
					const { createUserSession } = await import(
						"../middleware/session.middleware"
					);
					const session = await createUserSession(user.uid, req.sessionID, req);

					const token = signToken({
						uid: user.uid,
						email: user.email,
						username: user.username,
					});

					return res.json({
						token,
						sessionId: session.id,
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
				} catch (tokenError) {
					console.error("Token generation error:", tokenError);
					return res.status(500).json({ message: "Token generation failed" });
				}
			});
		})(req, res, next);
	} catch (error) {
		console.error("Login controller error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

// Google Sign-in Controller
export const googleLogin = async (req: Request, res: Response) => {
	try {
		const prisma = await connect();
		const { token: idToken } = req.body; // Get the ID token from the request body

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
		let user = await prisma.user.findUnique({ where: { email } });

		if (user) {
			// If user exists, log them in
			// Create session for existing user
			req.logIn(user, async (loginErr) => {
				if (loginErr) {
					console.error("Google login session error:", loginErr);
					return res.status(500).json({ message: "Session creation failed" });
				}

				try {
					const { createUserSession } = await import(
						"../middleware/session.middleware"
					);
					const session = await createUserSession(
						user!.uid,
						req.sessionID,
						req,
					);

					const token = signToken({
						uid: user!.uid,
						email: user!.email,
						username: user!.username,
					});

					return res.json({
						token,
						sessionId: session.id,
						user: {
							uid: user!.uid,
							name: user!.name,
							email: user!.email,
							username: user!.username,
							photoURL: user!.photoURL,
							hasBlueCheck: user!.hasBlueCheck,
							membership: {
								subscription: user!.subscription,
								nextBillingDate: user!.nextBillingDate,
							},
							privacy: user!.privacy,
							hasVerifiedEmail: user!.hasVerifiedEmail,
							createdAt: user!.createdAt,
							updatedAt: user!.updatedAt,
						},
					});
				} catch (sessionError) {
					console.error("Session creation error:", sessionError);
					return res.status(500).json({ message: "Session creation failed" });
				}
			});
		} else {
			// If user doesn't exist, create a new user
			let username = email.split("@")[0] ?? ""; // Basic username generation

			// Ensure username is unique by checking if it exists
			let existingUser = await prisma.user.findUnique({ where: { username } });
			let counter = 1;
			while (existingUser) {
				username = `${email.split("@")[0]}_${counter}`;
				existingUser = await prisma.user.findUnique({ where: { username } });
				counter++;
			}

			const subscription = "free" as Subscription; // Default to free subscription
			const privacy = DEFAULT_PRIVACY;

			user = await prisma.user.create({
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

			await prisma.credential.create({
				data: {
					userId: user.uid,
					provider: "google",
				},
			});

			// Create session for new user
			req.logIn(user, async (loginErr) => {
				if (loginErr) {
					console.error("Google new user session error:", loginErr);
					return res.status(500).json({ message: "Session creation failed" });
				}

				if (!user) {
					return res.status(500).json({ message: "User creation failed" });
				}

				try {
					const { createUserSession } = await import(
						"../middleware/session.middleware"
					);
					const session = await createUserSession(user.uid, req.sessionID, req);

					const token = signToken({
						uid: user.uid,
						email: user.email,
						username: user.username,
					});

					return res.status(201).json({
						token,
						sessionId: session.id,
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
				} catch (sessionError) {
					console.error("Session creation error:", sessionError);
					return res.status(500).json({ message: "Session creation failed" });
				}
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
	const prisma = await connect();
	const authUser = (req as any).user as { uid: string };

	const user = await prisma.user.findUnique({
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

export const googleCallback = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	passport.authenticate("google", (err: any, user: any, info: any) => {
		if (err) {
			return next(err);
		}
		if (!user) {
			return res.redirect("/login?error=google_auth_failed");
		}

		req.logIn(user, async (err) => {
			if (err) {
				return next(err);
			}

			try {
				// Create session with device tracking
				const { createUserSession } = await import(
					"../middleware/session.middleware"
				);
				const session = await createUserSession(user.uid, req.sessionID, req);

				const token = signToken({
					uid: user.uid,
					email: user.email,
					username: user.username,
				});

				// Redirect to frontend with token and session info
				const frontendUrl =
					process.env.FRONTEND_URL || "https://www.dopp.eu.org";
				const redirectUrl = `${frontendUrl}/auth/google/callback?token=${token}&sessionId=${session.id}&uid=${user.uid}`;

				return res.redirect(redirectUrl);
			} catch (sessionError) {
				console.error("Session creation error:", sessionError);
				return res.status(500).json({ message: "Session creation failed" });
			}
		});
	})(req, res, next);
};

export const logout = async (req: Request, res: Response) => {
	try {
		const prisma = await connect();
		const userId = (req.user as any)?.uid;

		req.logout(async (err) => {
			if (err) {
				return res.status(500).json({ message: "Logout failed" });
			}

			// Clear all sessions for this user from the database
			if (userId) {
				try {
					await prisma.session.deleteMany({
						where: { userId },
					});
				} catch (sessionError) {
					console.error("Failed to clear user sessions:", sessionError);
					// Don't fail the logout if session cleanup fails
				}
			}

			res.json({ message: "Logged out successfully" });
		});
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({ message: "Logout failed" });
	}
};

export const forgotPassword = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();
		const { email } = ForgotPasswordSchema.parse(req.body);

		// Check if user exists
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			// Don't reveal if email exists or not for security
			return res.json({ 
				message: "If your email is registered, you will receive a password reset code shortly." 
			});
		}

		// Check if user has a local credential (password-based account)
		const localCredential = await prisma.credential.findFirst({
			where: { 
				userId: user.uid,
				provider: "local"
			}
		});

		if (!localCredential) {
			return res.status(400).json({
				message: "This account uses social login. Please sign in with your social account."
			});
		}

		// Delete any existing password reset requests for this email
		await prisma.passwordReset.deleteMany({ where: { email } });

		// Create new password reset request
		const code = makeCode()();
		const resetId = makeVerificationId()();
		const expireAt = dayjs().add(15, "minute").toDate();

		await prisma.passwordReset.create({
			data: { email, code, resetId, expireAt },
		});

		await sendPasswordResetEmail(email, code, resetId);

		return res.json({
			message: "If your email is registered, you will receive a password reset code shortly.",
			resetId,
		});
	} catch (err: any) {
		console.error("Forgot password error:", err);
		next(err);
	}
};

export const resetPassword = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();
		const { email, code, resetId, newPassword } = ResetPasswordSchema.parse(req.body);

		// Find the reset request
		const resetRequest = await prisma.passwordReset.findUnique({ 
			where: { resetId } 
		});

		if (!resetRequest || resetRequest.email !== email) {
			return res.status(400).json({ message: "Invalid password reset request" });
		}

		if (dayjs(resetRequest.expireAt).isBefore(dayjs())) {
			return res.status(400).json({ message: "Password reset code expired" });
		}

		if (resetRequest.code !== code) {
			return res.status(400).json({ message: "Incorrect reset code" });
		}

		// Find the user and update their password
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Hash the new password
		const passwordHash = await bcrypt.hash(newPassword, 12);

		// Update user's password in credential table
		await prisma.credential.updateMany({
			where: { 
				userId: user.uid,
				provider: "local"
			},
			data: { passwordHash }
		});

		// Also update in user table for compatibility
		await prisma.user.update({
			where: { uid: user.uid },
			data: { password: passwordHash }
		});

		// Clean up the reset request
		await prisma.passwordReset.delete({ where: { resetId } });
		await prisma.passwordReset.deleteMany({ where: { email } });

		return res.json({ message: "Password reset successfully" });
	} catch (err: any) {
		console.error("Reset password error:", err);
		next(err);
	}
};

export const validateResetId = async (req: Request, res: Response) => {
	const prisma = await connect();
	const { resetId } = req.params;

	if (!resetId) {
		return res.status(400).json({
			message: "Reset ID is required",
		});
	}

	const record = await prisma.passwordReset.findUnique({
		where: { resetId },
	});

	if (!record) {
		return res.status(404).json({
			message: "Reset ID not found",
		});
	}

	const isExpired = dayjs(record.expireAt).isBefore(dayjs());

	if (isExpired)
		return res.status(400).json({
			message: "Password reset code expired",
		});

	return res.json({
		message: "Reset ID is valid",
		email: record.email,
	});
};

export const validateVerificationId = async (req: Request, res: Response) => {
	const prisma = await connect();
	const { verificationId } = req.params;

	if (!verificationId) {
		return res.status(400).json({
			message: "Verification ID is required",
		});
	}

	const record = await prisma.email.findUnique({
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

export const checkUsername = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();
		const { username } = CheckUsernameSchema.parse(req.body);

		const existingUser = await prisma.user.findUnique({
			where: { username },
		});

		return res.json({
			available: !existingUser,
			message: existingUser ? "Username is already taken" : "Username is available",
		});
	} catch (err: any) {
		next(err);
	}
};

export const checkEmail = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const prisma = await connect();
		const { email } = CheckEmailSchema.parse(req.body);

		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		return res.json({
			available: !existingUser,
			message: existingUser ? "Email is already registered" : "Email is available",
		});
	} catch (err: any) {
		next(err);
	}
};
