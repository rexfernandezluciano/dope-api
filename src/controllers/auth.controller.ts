/** @format */

import { Request, Response } from "express";
import { PrismaClient, Subscription, Credential } from "@prisma/client";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { customAlphabet } from "nanoid";
import { RegisterSchema, LoginSchema, VerifyEmailSchema, ResendCodeSchema } from "../utils/validate";
import { sendVerificationEmail } from "../utils/mailer";
import { signToken } from "../utils/jwt";

const prisma = new PrismaClient();
const makeCode = customAlphabet("0123456789", 6); // 6-digit numeric
const makeVerificationId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

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

export const register = async (req: Request, res: Response) => {
	try {
		const parsed = RegisterSchema.parse(req.body);
		const { name, email, username, photoURL, password } = parsed;
		const subscription = (parsed.subscription ?? "free") as Subscription;
		const privacy = parsed.privacy ?? DEFAULT_PRIVACY;

		const exists = await prisma.user.findUnique({ where: { email } });
		if (exists) return res.status(409).json({ message: "Email already registered" });

		const unameExists = await prisma.user.findUnique({ where: { username } });
		if (unameExists) return res.status(409).json({ message: "Username already taken" });

		const passwordHash = await bcrypt.hash(password, 12);

		const user = await prisma.user.create({
			data: {
				name,
				email,
				username,
				photoURL,
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

		// Create verification record
		const code = makeCode();
		const verificationId = makeVerificationId();
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
		if (err.name === "ZodError") return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		return res.status(500).json({ message: "Registration failed" });
	}
};

export const verifyEmail = async (req: Request, res: Response) => {
	try {
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
			data: { hasVerifiedEmail: true },
		});

		// Clean up all codes for this email
		await prisma.email.delete({ where: { verificationId } });
		await prisma.email.deleteMany({ where: { email } });

		return res.json({ message: "Email verified successfully" });
	} catch (err: any) {
		if (err.name === "ZodError") return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		return res.status(500).json({ message: "Verification failed" });
	}
};

export const resendCode = async (req: Request, res: Response) => {
	try {
		const { email } = ResendCodeSchema.parse(req.body);
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(404).json({ message: "User not found" });
		if (user.hasVerifiedEmail) return res.status(400).json({ message: "Email already verified" });

		// Invalidate old codes
		await prisma.email.deleteMany({ where: { email } });

		// Create new code
		const code = makeCode();
		const verificationId = makeVerificationId();
		const expireAt = dayjs().add(15, "minute").toDate();

		await prisma.email.create({
			data: { email, code, verificationId, expireAt },
		});

		await sendVerificationEmail(email, code, verificationId);

		return res.json({ message: "Verification code resent", verificationId });
	} catch (err: any) {
		if (err.name === "ZodError") return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		return res.status(500).json({ message: "Failed to resend code" });
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { email, password } = LoginSchema.parse(req.body);

		const user = await prisma.user.findUnique({ where: { email }, include: { credentials: true } });
		if (!user) return res.status(401).json({ message: "Invalid credentials" });

		const cred = user.credentials.find((c: Credential) => c.provider === "local");
		if (!cred?.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

		const ok = await bcrypt.compare(password, cred.passwordHash);
		if (!ok) return res.status(401).json({ message: "Invalid credentials" });

		// (Optional) require verified email
		if (!user.hasVerifiedEmail) {
			return res.status(403).json({ message: "Email not verified" });
		}

		const token = signToken({ uid: user.uid, email: user.email, username: user.username });

		return res.json({
			token,
			user: {
				uid: user.uid,
				name: user.name,
				email: user.email,
				username: user.username,
				photoURL: user.photoURL,
				hasBlueCheck: user.hasBlueCheck,
				subscription: user.subscription,
				privacy: user.privacy,
				hasVerifiedEmail: user.hasVerifiedEmail,
			},
		});
	} catch (err: any) {
		if (err.name === "ZodError") return res.status(400).json({ message: "Invalid payload", errors: err.errors });
		return res.status(500).json({ message: "Login failed" });
	}
};

export const me = async (req: Request, res: Response) => {
	const authUser = (req as any).user as { uid: number };
	const user = await prisma.user.findUnique({ where: { uid: authUser.uid } });
	if (!user) return res.status(404).json({ message: "User not found" });
	return res.json(user);
};
