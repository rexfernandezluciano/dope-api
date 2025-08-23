
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

/**
 * @swagger
 * tags:
 *   name: OAuth
 *   description: OAuth 2.0 authentication endpoints
 */

/**
 * @swagger
 * /oauth/authorize:
 *   get:
 *     summary: OAuth authorization endpoint
 *     tags: [OAuth]
 *     parameters:
 *       - in: query
 *         name: client_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: redirect_uri
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: response_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [code]
 *     responses:
 *       200:
 *         description: Authorization page or redirect
 */
router.get('/authorize', asyncHandler(authorize));

/**
 * @swagger
 * /oauth/token:
 *   post:
 *     summary: Exchange authorization code for access token
 *     tags: [OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [authorization_code]
 *               code:
 *                 type: string
 *               client_id:
 *                 type: string
 *               client_secret:
 *                 type: string
 *               redirect_uri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 token_type:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 */
router.post('/token', asyncHandler(token));

/**
 * @swagger
 * /oauth/revoke:
 *   post:
 *     summary: Revoke access token
 *     tags: [OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token revoked successfully
 */
router.post('/revoke', asyncHandler(revoke));

/**
 * @swagger
 * /oauth/apps:
 *   post:
 *     summary: Register OAuth application
 *     tags: [OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               redirect_uri:
 *                 type: string
 *               website:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application registered successfully
 */
router.post('/apps', asyncHandler(registerApp));

/**
 * @swagger
 * /oauth/userinfo:
 *   get:
 *     summary: Get user information using OAuth token
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get('/userinfo', authenticateOAuth, asyncHandler(userInfo));

export default router;
