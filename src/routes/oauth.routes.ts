
import { Router } from 'express';
import {
	authorize,
	token,
	revoke,
	userInfo,
	registerApp
} from '../controllers/oauth.controller';
import { authenticateOAuth } from '../middleware/oauth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// OAuth 2.0 endpoints
router.get('/authorize', asyncHandler(authorize));
router.post('/token', asyncHandler(token));
router.post('/revoke', asyncHandler(revoke));
router.post('/apps', asyncHandler(registerApp));

// Protected endpoints
router.get('/userinfo', authenticateOAuth, asyncHandler(userInfo));

export default router;
