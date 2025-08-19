/** @format */

import { Router } from "express";
import {
	getUsers,
	getUserByUsername,
	updateUser,
	toggleFollow,
	getUserFollowers,
	getUserFollowing,
} from "../controllers/user.controller";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", optionalAuth, getUsers);
router.get("/:username", optionalAuth, getUserByUsername);
router.get("/:username/followers", getUserFollowers);
router.get("/:username/following", getUserFollowing);

// Authenticated routes
router.put("/:username", requireAuth, updateUser);
router.post("/:username/follow", requireAuth, toggleFollow);

export default router;
