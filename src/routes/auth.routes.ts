/** @format */

import { Router } from "express";
import {
	register,
	verifyEmail,
	login,
	refreshToken,
	resendVerification,
	googleAuth,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-code", resendCode);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/me", requireAuth, me);

export default router;