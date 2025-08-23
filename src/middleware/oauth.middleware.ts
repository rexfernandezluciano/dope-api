
import { Request, Response, NextFunction } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
	prisma = await connect();
})();

export const authenticateOAuth = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({ error: 'unauthorized' });
		}

		const token = authHeader.slice(7);

		// Find access token
		const accessToken = await prisma.oAuthAccessToken.findUnique({
			where: { token },
			include: {
				user: true,
				application: true
			}
		});

		if (!accessToken) {
			return res.status(401).json({ error: 'invalid_token' });
		}

		// Check if token is expired
		if (accessToken.expiresAt < new Date()) {
			await prisma.oAuthAccessToken.delete({
				where: { token }
			});
			return res.status(401).json({ error: 'token_expired' });
		}

		// Attach user and application to request
		(req as any).user = accessToken.user;
		(req as any).oauthApp = accessToken.application;
		(req as any).oauthScope = accessToken.scope;

		next();
	} catch (error) {
		console.error('OAuth authentication error:', error);
		res.status(500).json({ error: 'server_error' });
	}
};

export const requireOAuthScope = (requiredScope: string) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const userScope = (req as any).oauthScope || '';
		const scopes = userScope.split(' ');

		if (!scopes.includes(requiredScope) && !scopes.includes('admin')) {
			return res.status(403).json({ 
				error: 'insufficient_scope',
				required_scope: requiredScope 
			});
		}

		next();
	};
};
