
import { Router } from 'express';
import {
	webfinger,
	getActor,
	handleInbox,
	getOutbox,
	getFollowers,
	getFollowing,
} from '../controllers/activitypub.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Content negotiation middleware for ActivityPub
const activityPubContentNegotiation = (req: any, res: any, next: any) => {
	const accept = req.headers.accept || '';
	
	if (
		accept.includes('application/activity+json') ||
		accept.includes('application/ld+json')
	) {
		req.isActivityPub = true;
	}
	
	next();
};

// ActivityPub routes
router.get('/users/:username', activityPubContentNegotiation, asyncHandler(getActor));
router.post('/users/:username/inbox', asyncHandler(handleInbox));
router.get('/users/:username/outbox', asyncHandler(getOutbox));
router.get('/users/:username/followers', asyncHandler(getFollowers));
router.get('/users/:username/following', asyncHandler(getFollowing));

export default router;
