/** @format */

import { Router } from "express";
import {
	register,
	verifyEmail,
	login,
	resendCode,
	googleLogin,
	me,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-code", resendCode);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", requireAuth, me);

export default router;