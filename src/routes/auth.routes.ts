/** @format */

import { Router } from "express";
import {
	register,
	verifyEmail,
	login,
	resendCode,
	googleLogin,
	validateVerificationId,
	me,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { verifyAppCheck } from "../middleware/firebase.middleware";

const router = Router();

router.post("/register", verifyAppCheck, register);
router.post("/verify-email", verifyAppCheck, verifyEmail);
router.post("/resend-code", verifyAppCheck, resendCode);
router.post("/login", verifyAppCheck, login);
router.post("/google", verifyAppCheck, googleLogin);
router.get("/validate-verification-id/:verificationId", verifyAppCheck, validateVerificationId)
router.get("/me", requireAuth, verifyAppCheck, me);

export default router;