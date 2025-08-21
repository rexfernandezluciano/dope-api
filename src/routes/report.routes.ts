
import { Router } from 'express';
import { createReport, getUserReports } from '../controllers/report.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/', requireAuth, createReport);
router.get('/my-reports', requireAuth, getUserReports);

export default router;
