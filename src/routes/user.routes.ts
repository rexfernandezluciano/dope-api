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
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", getUsers);
router.get("/:username", getUserByUsername);
router.get("/:username/followers", getUserFollowers);
router.get("/:username/following", getUserFollowing);

// Authenticated routes
router.put("/:username", requireAuth, updateUser);
router.post("/:username/follow", requireAuth, toggleFollow);

export default router;
