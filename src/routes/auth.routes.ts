/** @format */

import { Router } from "express";
import {
	register,
	verifyEmail,
	login,
	resendCode,
	googleLogin,
	googleAuth,
	googleCallback,
	logout,
	validateVerificationId,
	me,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-code", asyncHandler(resendCode));
router.post("/login", asyncHandler(login));
router.post("/google", asyncHandler(googleLogin)); // Keep existing endpoint for backward compatibility
router.get("/google", googleAuth); // New Passport Google OAuth initiation
router.get("/google/callback", asyncHandler(googleCallback)); // Google OAuth callback
router.post("/logout", asyncHandler(logout));
router.get("/validate-verification-id/:verificationId", asyncHandler(validateVerificationId))
router.get("/me", requireAuth, asyncHandler(me));

export default router;