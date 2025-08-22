
import { Router } from 'express';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  deletePaymentMethod, 
  getAvailablePaymentProviders,
  purchaseMembership,
  createPaymentIntent,
  handleStripeWebhook
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/providers', getAvailablePaymentProviders);
router.post('/methods', requireAuth, addPaymentMethod);
router.get('/methods', requireAuth, getPaymentMethods);
router.delete('/methods/:paymentMethodId', requireAuth, deletePaymentMethod);
router.post('/purchase-membership', requireAuth, purchaseMembership);
router.post('/create-payment-intent', requireAuth, createPaymentIntent);
router.post('/webhook', handleStripeWebhook); // No auth required for webhooks

export default router;
