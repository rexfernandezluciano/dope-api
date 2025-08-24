
import { Router } from 'express';
import { 
  subscribeToUser,
  tipUser,
  donateToUser,
  getUserSubscriptions,
  getCreatorSubscribers,
  createSticker,
  getStickers,
  createSubscriptionPerk,
  getSubscriptionPerks,
  getSubscriptionTiers,
  handleSubscriptionWebhook
} from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: User Subscriptions
 *   description: User-to-user subscriptions, tips, donations and stickers
 */

/**
 * @swagger
 * /subscriptions/tiers:
 *   get:
 *     summary: Get available subscription tiers
 *     tags: [User Subscriptions]
 *     responses:
 *       200:
 *         description: List of subscription tiers
 */
router.get('/tiers', asyncHandler(getSubscriptionTiers));

/**
 * @swagger
 * /subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to a user
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creatorId:
 *                 type: string
 *               tier:
 *                 type: string
 *                 enum: [basic, premium, vip]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription initiated
 */
router.post('/subscribe', requireAuth, asyncHandler(subscribeToUser));

/**
 * @swagger
 * /subscriptions/tip:
 *   post:
 *     summary: Send a tip to a user using credits
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 500000
 *                 description: Amount in centavos (₱1 = 100 centavos)
 *               message:
 *                 type: string
 *               postId:
 *                 type: string
 *               stickerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tip sent successfully using credits
 */
router.post('/tip', requireAuth, asyncHandler(tipUser));

/**
 * @swagger
 * /subscriptions/donate:
 *   post:
 *     summary: Send a donation to a user using credits
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 500
 *                 maximum: 1000000
 *                 description: Amount in centavos (₱5 = 500 centavos)
 *               message:
 *                 type: string
 *               isAnonymous:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Donation sent successfully using credits
 */
router.post('/donate', requireAuth, asyncHandler(donateToUser));

/**
 * @swagger
 * /subscriptions/donate:
 *   post:
 *     summary: Send a donation to a user
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 500
 *                 maximum: 1000000
 *               message:
 *                 type: string
 *               isAnonymous:
 *                 type: boolean
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Donation initiated
 */
router.post('/donate', requireAuth, asyncHandler(donateToUser));

/**
 * @swagger
 * /subscriptions/my-subscriptions:
 *   get:
 *     summary: Get user's subscriptions
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user subscriptions
 */
router.get('/my-subscriptions', requireAuth, asyncHandler(getUserSubscriptions));

/**
 * @swagger
 * /subscriptions/my-subscribers:
 *   get:
 *     summary: Get creator's subscribers
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subscribers and stats
 */
router.get('/my-subscribers', requireAuth, asyncHandler(getCreatorSubscribers));

/**
 * @swagger
 * /subscriptions/stickers:
 *   post:
 *     summary: Create a custom sticker
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [custom, emoji, animated, premium]
 *     responses:
 *       201:
 *         description: Sticker created
 *   get:
 *     summary: Get stickers
 *     tags: [User Subscriptions]
 *     parameters:
 *       - in: query
 *         name: creatorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of stickers
 */
router.post('/stickers', requireAuth, asyncHandler(createSticker));
router.get('/stickers', asyncHandler(getStickers));

/**
 * @swagger
 * /subscriptions/perks:
 *   post:
 *     summary: Create a subscription perk
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [basic, premium, vip]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Perk created
 */
router.post('/perks', requireAuth, asyncHandler(createSubscriptionPerk));

/**
 * @swagger
 * /subscriptions/perks/{creatorId}:
 *   get:
 *     summary: Get subscription perks for a creator
 *     tags: [User Subscriptions]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subscription perks
 */
router.get('/perks/:creatorId', asyncHandler(getSubscriptionPerks));

/**
 * @swagger
 * /subscriptions/webhook:
 *   post:
 *     summary: PayPal webhook handler for subscriptions
 *     tags: [User Subscriptions]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook', asyncHandler(handleSubscriptionWebhook));

export default router;
