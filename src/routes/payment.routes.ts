
import { Router } from 'express';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  deletePaymentMethod, 
  getAvailablePaymentProviders,
  purchaseMembership,
  handlePayPalWebhook
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment and subscription management
 */

/**
 * @swagger
 * /payments/providers:
 *   get:
 *     summary: Get available payment providers
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of payment providers
 */
router.get('/providers', asyncHandler(getAvailablePaymentProviders));

/**
 * @swagger
 * /payments/methods:
 *   post:
 *     summary: Add payment method
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *               paymentData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment method added
 *   get:
 *     summary: Get user payment methods
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 */
router.post('/methods', requireAuth, asyncHandler(addPaymentMethod));
router.get('/methods', requireAuth, asyncHandler(getPaymentMethods));

/**
 * @swagger
 * /payments/methods/{paymentMethodId}:
 *   delete:
 *     summary: Delete payment method
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method deleted
 */
router.delete('/methods/:paymentMethodId', requireAuth, asyncHandler(deletePaymentMethod));

/**
 * @swagger
 * /payments/purchase-membership:
 *   post:
 *     summary: Purchase membership subscription
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscriptionType:
 *                 type: string
 *                 enum: [premium, pro]
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Membership purchased successfully
 */
router.post('/purchase-membership', requireAuth, asyncHandler(purchaseMembership));

/**
 * @swagger
 * /payments/webhook/paypal:
 *   post:
 *     summary: PayPal webhook handler
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhook/paypal', asyncHandler(handlePayPalWebhook));

export default router;
