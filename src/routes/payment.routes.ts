
import { Router } from 'express';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  deletePaymentMethod, 
  getAvailablePaymentProviders 
} from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/providers', getAvailablePaymentProviders);
router.post('/methods', requireAuth, addPaymentMethod);
router.get('/methods', requireAuth, getPaymentMethods);
router.delete('/methods/:paymentMethodId', requireAuth, deletePaymentMethod);

export default router;
