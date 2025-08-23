
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

router.get('/providers', asyncHandler(getAvailablePaymentProviders));
router.post('/methods', requireAuth, asyncHandler(addPaymentMethod));
router.get('/methods', requireAuth, asyncHandler(getPaymentMethods));
router.delete('/methods/:paymentMethodId', requireAuth, asyncHandler(deletePaymentMethod));
router.post('/purchase-membership', requireAuth, asyncHandler(purchaseMembership));
router.post('/webhook/paypal', asyncHandler(handlePayPalWebhook)); // PayPal webhook

export default router;
