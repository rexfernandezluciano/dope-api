
import { Router } from 'express';
import { createReport, getUserReports } from '../controllers/report.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateToken, createReport);
router.get('/my-reports', authenticateToken, getUserReports);

export default router;
