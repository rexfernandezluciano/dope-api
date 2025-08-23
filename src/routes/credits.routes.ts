
import { Router } from 'express';
import { 
  getCredits,
  purchaseCredits,
  handleCreditsWebhook,
  getCreditPackages
} from '../controllers/credits.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Credits
 *   description: Credits management for ad campaigns
 */

/**
 * @swagger
 * /credits:
 *   get:
 *     summary: Get user's current credits
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's credit balance
 */
router.get('/', requireAuth, asyncHandler(getCredits));

/**
 * @swagger
 * /credits/packages:
 *   get:
 *     summary: Get available credit packages
 *     tags: [Credits]
 *     responses:
 *       200:
 *         description: Available credit packages
 */
router.get('/packages', asyncHandler(getCreditPackages));

/**
 * @swagger
 * /credits/purchase:
 *   post:
 *     summary: Purchase credits
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credit purchase initiated
 */
router.post('/purchase', requireAuth, asyncHandler(purchaseCredits));

/**
 * @swagger
 * /credits/webhook/paypal:
 *   post:
 *     summary: PayPal webhook for credits
 *     tags: [Credits]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook/paypal', asyncHandler(handleCreditsWebhook));

export default router;
