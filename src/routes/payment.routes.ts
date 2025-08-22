
import { Router } from 'express';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  deletePaymentMethod, 
  getAvailablePaymentProviders,
  purchaseMembership,
  handlePayMongoWebhook
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/providers', getAvailablePaymentProviders);
router.post('/methods', requireAuth, addPaymentMethod);
router.get('/methods', requireAuth, getPaymentMethods);
router.delete('/methods/:paymentMethodId', requireAuth, deletePaymentMethod);
router.post('/purchase-membership', requireAuth, purchaseMembership);
router.post('/webhook/paymongo', handlePayMongoWebhook); // PayMongo webhook

export default router;
