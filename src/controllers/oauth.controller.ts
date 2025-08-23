
import { Request, Response } from 'express';
import { connect } from '../database/database';
import crypto from 'crypto';
import { signToken } from '../utils/jwt';

let prisma: any;

(async () => {
	prisma = await connect();
})();

// OAuth 2.0 Authorization endpoint
export const authorize = async (req: Request, res: Response) => {
	try {
		const {
			response_type,
			client_id,
			redirect_uri,
			scope,
			state,
			code_challenge,
			code_challenge_method
		} = req.query;

		// Validate required parameters
		if (response_type !== 'code') {
			return res.status(400).json({ error: 'unsupported_response_type' });
		}

		if (!client_id || !redirect_uri) {
			return res.status(400).json({ error: 'invalid_request' });
		}

		// Find or create OAuth application
		let app = await prisma.oAuthApplication.findUnique({
			where: { clientId: client_id as string }
		});

		if (!app) {
			// For fediverse, auto-register applications with basic info
			app = await prisma.oAuthApplication.create({
				data: {
					name: `Fediverse App ${client_id}`,
					clientId: client_id as string,
					clientSecret: crypto.randomBytes(32).toString('hex'),
					redirectUris: [redirect_uri as string],
					scopes: 'read write follow',
					website: new URL(redirect_uri as string).origin
				}
			});
		}

		// Validate redirect URI
		if (!app.redirectUris.includes(redirect_uri as string)) {
			return res.status(400).json({ error: 'invalid_redirect_uri' });
		}

		// Check if user is authenticated
		const user = (req as any).user;
		if (!user) {
			// Redirect to login with OAuth parameters preserved
			const loginUrl = new URL('/login', req.get('host'));
			loginUrl.searchParams.set('oauth_return', req.url);
			return res.redirect(loginUrl.toString());
		}

		// Generate authorization code
		const authCode = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		await prisma.oAuthAuthorizationCode.create({
			data: {
				code: authCode,
				applicationId: app.id,
				userId: user.uid,
				redirectUri: redirect_uri as string,
				scope: scope as string || 'read',
				codeChallenge: code_challenge as string,
				codeChallengeMethod: code_challenge_method as string || 'S256',
				expiresAt
			}
		});

		// Redirect back to client with authorization code
		const redirectUrl = new URL(redirect_uri as string);
		redirectUrl.searchParams.set('code', authCode);
		if (state) {
			redirectUrl.searchParams.set('state', state as string);
		}

		res.redirect(redirectUrl.toString());
	} catch (error) {
		console.error('OAuth authorize error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};

// OAuth 2.0 Token endpoint
export const token = async (req: Request, res: Response) => {
	try {
		const {
			grant_type,
			code,
			redirect_uri,
			client_id,
			client_secret,
			code_verifier
		} = req.body;

		if (grant_type !== 'authorization_code') {
			return res.status(400).json({ error: 'unsupported_grant_type' });
		}

		// Find authorization code
		const authCode = await prisma.oAuthAuthorizationCode.findUnique({
			where: { code },
			include: {
				application: true,
				user: true
			}
		});

		if (!authCode || authCode.expiresAt < new Date()) {
			return res.status(400).json({ error: 'invalid_grant' });
		}

		// Validate client credentials
		if (authCode.application.clientId !== client_id) {
			return res.status(400).json({ error: 'invalid_client' });
		}

		if (authCode.application.clientSecret !== client_secret) {
			return res.status(400).json({ error: 'invalid_client' });
		}

		// Validate redirect URI
		if (authCode.redirectUri !== redirect_uri) {
			return res.status(400).json({ error: 'invalid_grant' });
		}

		// Validate PKCE if present
		if (authCode.codeChallenge && code_verifier) {
			const challengeMethod = authCode.codeChallengeMethod || 'S256';
			let computedChallenge: string;

			if (challengeMethod === 'S256') {
				computedChallenge = crypto
					.createHash('sha256')
					.update(code_verifier)
					.digest('base64url');
			} else if (challengeMethod === 'plain') {
				computedChallenge = code_verifier;
			} else {
				return res.status(400).json({ error: 'invalid_request' });
			}

			if (computedChallenge !== authCode.codeChallenge) {
				return res.status(400).json({ error: 'invalid_grant' });
			}
		}

		// Generate access token
		const accessToken = crypto.randomBytes(32).toString('hex');
		const refreshToken = crypto.randomBytes(32).toString('hex');
		const expiresIn = 7200; // 2 hours
		const expiresAt = new Date(Date.now() + expiresIn * 1000);

		// Create token record
		await prisma.oAuthAccessToken.create({
			data: {
				token: accessToken,
				refreshToken,
				applicationId: authCode.application.id,
				userId: authCode.user.uid,
				scope: authCode.scope,
				expiresAt
			}
		});

		// Delete used authorization code
		await prisma.oAuthAuthorizationCode.delete({
			where: { code }
		});

		res.json({
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: expiresIn,
			refresh_token: refreshToken,
			scope: authCode.scope,
			created_at: Math.floor(Date.now() / 1000)
		});
	} catch (error) {
		console.error('OAuth token error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};

// OAuth 2.0 Revoke endpoint
export const revoke = async (req: Request, res: Response) => {
	try {
		const { token, token_type_hint } = req.body;

		if (!token) {
			return res.status(400).json({ error: 'invalid_request' });
		}

		// Try to find and revoke the token
		if (token_type_hint === 'refresh_token') {
			await prisma.oAuthAccessToken.deleteMany({
				where: { refreshToken: token }
			});
		} else {
			await prisma.oAuthAccessToken.deleteMany({
				where: { token }
			});
		}

		res.status(200).json({});
	} catch (error) {
		console.error('OAuth revoke error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};

// Get current user info (for OAuth-authenticated requests)
export const userInfo = async (req: Request, res: Response) => {
	try {
		const user = (req as any).user;
		if (!user) {
			return res.status(401).json({ error: 'unauthorized' });
		}

		const userInfo = await prisma.user.findUnique({
			where: { uid: user.uid },
			select: {
				uid: true,
				username: true,
				name: true,
				bio: true,
				photoURL: true,
				createdAt: true,
				hasVerifiedEmail: true
			}
		});

		if (!userInfo) {
			return res.status(404).json({ error: 'user_not_found' });
		}

		res.json({
			id: userInfo.uid,
			username: userInfo.username,
			display_name: userInfo.name,
			note: userInfo.bio || '',
			avatar: userInfo.photoURL || '',
			created_at: userInfo.createdAt.toISOString(),
			verified: userInfo.hasVerifiedEmail,
			url: `${req.protocol}://${req.get('host')}/@${userInfo.username}`
		});
	} catch (error) {
		console.error('OAuth userinfo error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};

// Application registration endpoint
export const registerApp = async (req: Request, res: Response) => {
	try {
		const { client_name, redirect_uris, scopes, website } = req.body;

		if (!client_name || !redirect_uris) {
			return res.status(400).json({ error: 'invalid_request' });
		}

		const clientId = crypto.randomBytes(16).toString('hex');
		const clientSecret = crypto.randomBytes(32).toString('hex');

		const app = await prisma.oAuthApplication.create({
			data: {
				name: client_name,
				clientId,
				clientSecret,
				redirectUris: Array.isArray(redirect_uris) ? redirect_uris : [redirect_uris],
				scopes: scopes || 'read',
				website: website || ''
			}
		});

		res.json({
			id: app.id,
			name: app.name,
			website: app.website,
			redirect_uri: app.redirectUris[0],
			client_id: app.clientId,
			client_secret: app.clientSecret,
			vapid_key: '' // For push notifications, can be added later
		});
	} catch (error) {
		console.error('OAuth app registration error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};
