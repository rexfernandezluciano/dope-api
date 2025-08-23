
import { Router } from 'express';
import { getBaseUrl } from '../config/activitypub';

const router = Router();

// OAuth Authorization Server Metadata (RFC 8414)
router.get('/oauth-authorization-server', (req, res) => {
	const baseUrl = getBaseUrl(req);
	
	res.json({
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/oauth/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
		registration_endpoint: `${baseUrl}/oauth/apps`,
		scopes_supported: ['read', 'write', 'follow', 'push'],
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code'],
		code_challenge_methods_supported: ['S256', 'plain'],
		token_endpoint_auth_methods_supported: ['client_secret_post'],
		service_documentation: `${baseUrl}/api/docs`,
		ui_locales_supported: ['en']
	});
});

export default router;
