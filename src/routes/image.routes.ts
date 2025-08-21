
import { Router } from "express";
import { uploadImages, uploadMiddleware } from "../controllers/image.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/upload", requireAuth, uploadMiddleware, uploadImages);

export default router;
