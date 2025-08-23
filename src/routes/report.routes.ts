
import { Router } from 'express';
import { createReport, getUserReports } from '../controllers/report.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Content reporting endpoints
 */

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Create a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [post, comment, user]
 *               targetId:
 *                 type: string
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report created successfully
 */
router.post('/', requireAuth, createReport);

/**
 * @swagger
 * /reports/my-reports:
 *   get:
 *     summary: Get user's reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user reports
 */
router.get('/my-reports', requireAuth, getUserReports);

export default router;
