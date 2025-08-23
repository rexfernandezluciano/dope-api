
import { Router } from "express";
import { uploadImages, uploadMiddleware } from "../controllers/image.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

router.post("/upload", requireAuth, uploadMiddleware, asyncHandler(uploadImages));

export default router;
