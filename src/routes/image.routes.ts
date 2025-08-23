
import { Router } from "express";
import { uploadImages, uploadMiddleware } from "../controllers/image.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Image upload and management
 */

/**
 * @swagger
 * /images/upload:
 *   post:
 *     summary: Upload images
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrls:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uri
 */
router.post("/upload", requireAuth, uploadMiddleware, asyncHandler(uploadImages));

export default router;
