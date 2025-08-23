/** @format */

import { z } from "zod";

export const ForgotPasswordSchema = z.object({
	email: z.string().email("Invalid email format"),
});

export const ResetPasswordSchema = z.object({
	email: z.string().email("Invalid email format"),
	code: z.string().length(6, "Verification code must be 6 digits"),
	resetId: z.string().min(1, "Reset ID is required"),
	newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const RegisterSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	username: z.string().min(3),
	photoURL: z.string().url(),
	password: z.string().min(8),
	subscription: z.enum(["free", "premium", "pro"]).optional(),
	privacy: z
		.object({
			profile: z.enum(["public", "private"]).default("public"),
			comments: z.enum(["public", "followers", "private"]).default("public"),
			sharing: z.boolean().default(true),
			chat: z.enum(["public", "followers", "private"]).default("public"),
		})
		.optional(),
});

export const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export const VerifyEmailSchema = z.object({
	email: z.string().email(),
	code: z.string().min(4).max(8),
	verificationId: z.string().min(10),
});

export const ResendCodeSchema = z.object({
	email: z.string().email(),
});
