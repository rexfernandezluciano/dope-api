
import { Router } from 'express';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  deletePaymentMethod, 
  getAvailablePaymentProviders 
} from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/providers', getAvailablePaymentProviders);
router.post('/methods', authenticateToken, addPaymentMethod);
router.get('/methods', authenticateToken, getPaymentMethods);
router.delete('/methods/:paymentMethodId', authenticateToken, deletePaymentMethod);

export default router;
