
import { Router } from 'express';
import { moderatePost } from '../controllers/content.controller';

const router = Router();

router.post('/moderate', moderatePost);

export default router;
